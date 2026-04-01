import { Temporal } from "@js-temporal/polyfill";
import debug from "debug";
import { map } from "radashi";
import captureAndLogError from "~/lib/captureAndLogError.server";
import generateBotInsight from "~/lib/llm-visibility/generateBotInsight";
import queryAccount from "~/lib/llm-visibility/queryAccount";
import prisma from "~/lib/prisma.server";
import { UsageLimitExceededError } from "~/lib/usage/UsageLimitExceededError";

const logger = debug("server");

/**
 * This function is called by the cron job to prepare the sites for the digest
 * email.
 *
 * @returns A list of sites that are prepared for the digest email.
 */
export default async function prepareSites(): Promise<
  { id: string; domain: string }[]
> {
  const trialDays = 25;
  const sitesForDigest = await getSitesForDigest(trialDays);
  logger(
    "[processSites] Processing %d sites: %s",
    sitesForDigest.length,
    sitesForDigest.map((s) => s.domain).join(", "),
  );

  await map(sitesForDigest, async (site) => {
    await Promise.all([nextCitationRun(site), updateBotInsight(site)]);
  });
  return sitesForDigest;
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
    logger("[processSites] Citation run done — %s", site.domain);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger("[processSites] Citation run failed — %s: %s", site.domain, message);
    if (!(error instanceof UsageLimitExceededError))
      captureAndLogError(error, {
        extra: { siteId: site.id, step: "citation-run" },
      });
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
    logger("[processSites] Bot insight done — %s", site.domain);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger("[processSites] Bot insight failed — %s: %s", site.domain, message);
    captureAndLogError(error, {
      extra: { siteId: site.id, step: "bot-insight" },
    });
    return false;
  }
}
