import { Temporal } from "@js-temporal/polyfill";
import { ms } from "convert";
import debug from "debug";
import { delay, mapAsync } from "es-toolkit";
import { data } from "react-router";
import sendTrialEndedEmail from "~/emails/TrialEnded";
import sendTrialEndingEmail from "~/emails/TrialEnding";
import sendWeeklyDigestEmail from "~/emails/WeeklyDigest";
import envVars from "~/lib/envVars";
import generateBotInsight from "~/lib/llm-visibility/generateBotInsight";
import queryAccount from "~/lib/llm-visibility/queryAccount";
import logError from "~/lib/logError.server";
import prisma from "~/lib/prisma.server";
import { UsageLimitExceededError } from "~/lib/usage/UsageLimitExceededError";
import {
  generateCitationChart,
  getWeeklyMetrics,
} from "~/lib/weeklyDigest.server";
import type { Prisma } from "~/prisma";
import type { Route } from "./+types/cron.process-sites";

const logger = debug("server");

// This function can run for a maximum of 300 seconds (5 minutes)
export const config = {
  maxDuration: 300,
};

export async function loader({ request }: Route.LoaderArgs) {
  if (request.headers.get("authorization") !== `Bearer ${envVars.CRON_SECRET}`)
    throw new Response("Unauthorized", { status: 401 });

  const notRecentlyProcessed = new Date(
    Temporal.Now.instant().subtract({ hours: 24 }).epochMilliseconds,
  );
  const inFreeTrial = new Date(
    Temporal.Now.instant().subtract({ hours: 25 * 24 }).epochMilliseconds,
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
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
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
    return !lastRun || lastRun.createdAt <= notRecentlyProcessed;
  });

  logger(
    "[cron:process-sites] Processing %d/%d sites: %s",
    qualifying.length,
    sites.length,
    qualifying.map((s) => s.domain).join(", "),
  );

  const results = await mapAsync(qualifying, async (site) => {
    // NOTE Always run updates first and then send the digest email.
    const [citationRun, botInsight] = await Promise.all([
      nextCitationRun(site),
      updateBotInsight(site),
    ]);
    const emailIds = await sendDigestEmails(site);
    return {
      botInsight,
      citationRun,
      emailIds,
      siteId: site.id,
    };
  });

  // Send trial-ending emails to users whose trial ends in ~2 days
  const trialEndingSoon = new Date(
    Temporal.Now.instant().subtract({ hours: 23 * 24 }).epochMilliseconds,
  );
  const trialEndingSoonCutoff = new Date(
    Temporal.Now.instant().subtract({ hours: 22 * 24 }).epochMilliseconds,
  );

  const trialEndingUsers = await prisma.user.findMany({
    where: {
      createdAt: { gte: trialEndingSoonCutoff, lte: trialEndingSoon },
      account: null,
    },
    include: {
      ownedSites: {
        take: 1,
        select: {
          id: true,
          domain: true,
          _count: { select: { citationRuns: true } },
        },
      },
    },
  });

  for (const user of trialEndingUsers) {
    const site = user.ownedSites[0];
    if (!site || user.unsubscribed) continue;
    const citationCount = await countSiteCitations(site.id);
    await sendTrialEndingEmail({
      user,
      citationCount,
      domain: site.domain,
    });
  }

  // Send trial-ended email to users whose trial ended today
  const trialEndedToday = new Date(
    Temporal.Now.instant().subtract({ hours: 25 * 24 }).epochMilliseconds,
  );
  const trialEndedYesterday = new Date(
    Temporal.Now.instant().subtract({ hours: 24 * 24 }).epochMilliseconds,
  );

  const trialEndedUsers = await prisma.user.findMany({
    where: {
      createdAt: { gte: trialEndedToday, lte: trialEndedYesterday },
      account: null,
    },
    include: {
      ownedSites: {
        take: 1,
        select: {
          id: true,
          domain: true,
          _count: { select: { citationRuns: true } },
        },
      },
    },
  });

  for (const user of trialEndedUsers) {
    const site = user.ownedSites[0];
    if (!site || user.unsubscribed) continue;
    const citationCount = await countSiteCitations(site.id);
    await sendTrialEndedEmail({
      user,
      citationCount,
      domain: site.domain,
      queryCount: site._count.citationRuns,
    });
  }

  if (envVars.HEARTBEAT_CRON_PROCESS_SITES)
    await fetch(envVars.HEARTBEAT_CRON_PROCESS_SITES);
  return data({ ok: true, results });
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

async function sendDigestEmails(
  site: Prisma.SiteGetPayload<{
    select: {
      id: true;
      domain: true;
      owner: {
        select: {
          id: true;
          email: true;
          unsubscribed: true;
        };
        where: { unsubscribed: false };
      };
      siteUsers: {
        select: {
          user: {
            select: {
              id: true;
              email: true;
              unsubscribed: true;
            };
            where: { user: { unsubscribed: false } };
          };
        };
      };
    };
  }>,
): Promise<{ id: string }[]> {
  try {
    const metrics = await getWeeklyMetrics(site.id, site.domain);
    const chartBase64 = await generateCitationChart(
      metrics.dailyCitations,
      metrics.prevDailyCitations,
    );
    const recipients = [site.owner, ...site.siteUsers.map((su) => su.user)];

    const emailIds = [];
    for (const user of recipients) {
      const emailId = await sendWeeklyDigestEmail({
        user,
        domain: site.domain,
        metrics,
        chartBase64,
      });
      if (emailId) emailIds.push(emailId);
      await delay(ms("1s"));
    }

    logger(
      "[cron:process-sites] Digest done — %s, sent %d",
      site.domain,
      emailIds.length,
    );
    return emailIds;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger("[cron:process-sites] Digest failed — %s: %s", site.domain, message);
    logError(error, { extra: { siteId: site.id, step: "digest" } });
    return [];
  }
}

async function countSiteCitations(siteId: string): Promise<number> {
  const queries = await prisma.citationQuery.findMany({
    where: { run: { siteId } },
    select: { citations: true },
  });
  return queries.reduce((sum, q) => sum + q.citations.length, 0);
}
