import { Temporal } from "@js-temporal/polyfill";
import debug from "debug";
import { map } from "radashi";
import captureAndLogError from "~/lib/captureAndLogError.server";
import generateBotInsight from "~/lib/llm-visibility/generateBotInsight";
import PLATFORMS from "~/lib/llm-visibility/platformQueries.server";
import { queryPlatform as runPlatform } from "~/lib/llm-visibility/queryPlatform";
import prisma from "~/lib/prisma.server";
import { UsageLimitExceededError } from "~/lib/usage/UsageLimitExceededError";
import {
  TRIAL_DAYS,
  canLastProcess,
  isProcessingEligible,
} from "~/lib/userPlan.server";
import { daysAgo } from "./formatDate";

const logger = debug("server");

/**
 * Prepare sites for the digest email.
 *
 * Selects sites whose owner is eligible for processing based on their plan:
 * - paid/gratis: process if lastProcessedAt is null or older than 24 hours
 * - trial: process if lastProcessedAt is null or older than 7 days, and owner
 *   account is less than 25 days old
 * - cancelled: never processed
 *
 * Runs a citation pass and updates the bot insight for each eligible site,
 * then sets lastProcessedAt = now.
 *
 * Returns the processed sites so the caller can decide which also need a
 * digest email (digestSentAt is a separate concern).
 */
export default async function prepareSites({
  maxSites = 3,
}: {
  maxSites?: number;
} = {}): Promise<{ id: string; domain: string; digestSentAt: Date | null }[]> {
  const candidates = await prisma.site.findMany({
    select: {
      id: true,
      domain: true,
      digestSentAt: true,
      lastProcessedAt: true,
      owner: { select: { plan: true, createdAt: true } },
    },
    where: {
      owner: {
        OR: [
          { plan: { in: ["paid", "gratis"] } },
          { plan: "trial", createdAt: { gte: daysAgo(TRIAL_DAYS) } },
        ],
      },
    },
  });

  const due = candidates
    .filter(
      (site) =>
        isProcessingEligible({
          plan: site.owner.plan,
          createdAt: site.owner.createdAt,
        }) &&
        canLastProcess({
          plan: site.owner.plan,
          lastProcessedAt: site.lastProcessedAt,
        }),
    )
    .sort((a, b) => {
      if (a.lastProcessedAt === null && b.lastProcessedAt !== null) return -1;
      if (a.lastProcessedAt !== null && b.lastProcessedAt === null) return 1;
      return 0;
    })
    .slice(0, maxSites);

  logger(
    "[prepareSites] Processing %d sites: %s",
    due.length,
    due.map((s) => s.domain).join(", "),
  );

  await map(due, nextCitationRun);
  await map(due, updateBotInsight);
  return due;
}

/**
 * Run a citation run for a site.
 *
 * @param site The site to run a citation run for.
 * @returns True if the citation run was successful, false otherwise.
 */
async function nextCitationRun(site: {
  id: string;
  domain: string;
}): Promise<boolean> {
  try {
    const queries = await prisma.siteQuery.findMany({
      orderBy: [{ group: "asc" }, { query: "asc" }],
      select: { query: true, group: true },
      where: { siteId: site.id },
    });
    await map(PLATFORMS, ({ name: platform, model, queryFn }) =>
      runPlatform({ model, platform, queries, queryFn, site }),
    );

    logger("[processSites] Citation run done — %s", site.domain);
    await prisma.site.update({
      where: { id: site.id },
      data: { lastProcessedAt: new Date() },
    });

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

/**
 * Update the bot insight for a site.
 *
 * It loads the bot visits for the last 7 days and generates a bot insight
 * report.
 *
 * @param site The site to update the bot insight for.
 * @returns True if the bot insight was updated successfully, false otherwise.
 */
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
