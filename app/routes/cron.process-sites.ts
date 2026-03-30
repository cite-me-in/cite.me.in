import { Temporal } from "@js-temporal/polyfill";
import debug from "debug";
import { map } from "radashi";
import { data } from "react-router";
import sendTrialEndedEmails from "~/emails/TrialEnded";
import sendTrialEndingEmails from "~/emails/TrialEnding";
import { sendSiteDigestEmails } from "~/emails/WeeklyDigest";
import envVars from "~/lib/envVars";
import generateBotInsight from "~/lib/llm-visibility/generateBotInsight";
import queryAccount from "~/lib/llm-visibility/queryAccount";
import logError from "~/lib/logError.server";
import prisma from "~/lib/prisma.server";
import { UsageLimitExceededError } from "~/lib/usage/UsageLimitExceededError";
import { loadWeeklyDigestMetrics } from "~/lib/weeklyDigest.server";
import type { Route } from "./+types/cron.process-sites";

const logger = debug("server");

// This function can run for a maximum of 300 seconds (5 minutes)
export const config = {
  maxDuration: 300,
};

export async function loader({ request }: Route.LoaderArgs) {
  if (request.headers.get("authorization") !== `Bearer ${envVars.CRON_SECRET}`)
    throw new Response("Unauthorized", { status: 401 });

  const trialDays = 25;
  const sitesForDigest = await getSitesForDigest(trialDays);
  logger(
    "[cron:process-sites] Processing %d sites: %s",
    sitesForDigest.length,
    sitesForDigest.map((s) => s.domain).join(", "),
  );

  const results: { emailIds: string[]; domain: string }[] = [];
  await map(sitesForDigest, async (site) => {
    // NOTE Always run updates first and then send the digest email.
    await Promise.all([nextCitationRun(site), updateBotInsight(site)]);
    const data = await loadWeeklyDigestMetrics(site.id);
    const sendEmails = await sendSiteDigestEmails(data);
    results.push({
      emailIds: sendEmails.map((e) => e.id),
      domain: site.domain,
    });
  });

  // Send trial-ending and trial-ended emails after all sites have been processed.
  await Promise.all([
    sendTrialEndingEmails(trialDays),
    sendTrialEndedEmails(trialDays),
  ]);

  if (envVars.HEARTBEAT_CRON_PROCESS_SITES)
    await fetch(envVars.HEARTBEAT_CRON_PROCESS_SITES);
  return data({ ok: true, results });
}

async function getSitesForDigest(
  trialDays: number,
): Promise<{ id: string; domain: string }[]> {
  const notRecentlyProcessed = new Date(
    Temporal.Now.instant().subtract({ hours: 24 }).epochMilliseconds,
  );
  const inFreeTrial = new Date(
    Temporal.Now.instant().subtract({ hours: trialDays * 24 })
      .epochMilliseconds,
  );

  const sites = await prisma.site.findMany({
    select: {
      id: true,
      domain: true,
      createdAt: true,
      owner: {
        select: {
          id: true,
          createdAt: true,
          email: true,
          unsubscribed: true,
          account: { select: { status: true } },
        },
      },
      siteUsers: {
        select: {
          user: {
            select: { id: true, email: true, unsubscribed: true },
          },
        },
      },
      citationRuns: {
        orderBy: { onDate: "desc" },
        take: 1,
        select: { onDate: true },
      },
    },
    where: {
      OR: [
        // Site owner has an active (paid) account.
        { owner: { account: { status: "active" } } },
        // Site owner is still in their free trial period.
        { owner: { createdAt: { gte: inFreeTrial } } },
      ],
    },
  });

  const qualifying = sites.filter((site) => {
    // Sites that have not been processed in the last day.
    const lastRun = site.citationRuns[0];
    return (
      !lastRun ||
      new Date(lastRun.onDate).getTime() <= notRecentlyProcessed.getTime()
    );
  });
  return qualifying;
}

async function nextCitationRun(site: {
  id: string;
  domain: string;
}): Promise<boolean> {
  try {
    const siteQueryRows = await prisma.siteQuery.findMany({
      where: { siteId: site.id },
      orderBy: [{ group: "asc" }, { query: "asc" }],
    });
    const queries = siteQueryRows
      .filter((q) => q.query.trim())
      .map((q) => ({ query: q.query, group: q.group }));
    await queryAccount({ site, queries });
    logger("[cron:process-sites] Citation run done — %s", site.domain);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger(
      "[cron:process-sites] Citation run failed — %s: %s",
      site.domain,
      message,
    );
    if (!(error instanceof UsageLimitExceededError))
      logError(error, { extra: { siteId: site.id, step: "citation-run" } });
    return false;
  }
}

async function updateBotInsight(site: {
  id: string;
  domain: string;
}): Promise<boolean> {
  try {
    const sevenDaysAgo = new Date(
      Temporal.Now.instant().subtract({ hours: 24 * 7 }).epochMilliseconds,
    );

    const visits = await prisma.botVisit.findMany({
      where: { siteId: site.id, date: { gte: sevenDaysAgo } },
      select: { botType: true, path: true, count: true },
    });
    const byBot: Record<
      string,
      { total: number; pathCounts: Record<string, number> }
    > = {};
    for (const v of visits) {
      if (!byBot[v.botType]) byBot[v.botType] = { total: 0, pathCounts: {} };
      byBot[v.botType].total += v.count;
      byBot[v.botType].pathCounts[v.path] =
        (byBot[v.botType].pathCounts[v.path] ?? 0) + v.count;
    }
    const botStats = Object.entries(byBot)
      .sort(([, a], [, b]) => b.total - a.total)
      .map(([botType, { total, pathCounts }]) => ({
        botType,
        total,
        topPaths: Object.entries(pathCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([p]) => p),
      }));
    const content = await generateBotInsight(site.domain, botStats);
    const now = new Date();
    await prisma.botInsight.upsert({
      where: { siteId: site.id },
      create: { siteId: site.id, content, generatedAt: now },
      update: { content, generatedAt: now },
    });
    logger("[cron:process-sites] Bot insight done — %s", site.domain);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger(
      "[cron:process-sites] Bot insight failed — %s: %s",
      site.domain,
      message,
    );
    logError(error, { extra: { siteId: site.id, step: "bot-insight" } });
    return false;
  }
}
