import { Temporal } from "@js-temporal/polyfill";
import { parallel } from "radashi";
import captureAndLogError from "~/lib/captureAndLogError.server";
import generateBotInsight from "~/lib/llm-visibility/generateBotInsight";
import PLATFORMS from "~/lib/llm-visibility/platformQueries.server";
import { queryPlatform as runPlatform } from "~/lib/llm-visibility/queryPlatform";
import prisma from "~/lib/prisma.server";
import { queryNextToProcess } from "~/lib/userPlan.server";
import upsertCitingPages from "./llm-visibility/upsertCitingPages";

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
 *
 * @param domain If provided, only process the site with the given domain.
 * @param maxSites The maximum number of sites to process.
 * @param log - The log function to use.
 * @returns The processed sites.
 */
export default async function prepareSites({
  domain,
  maxSites = 3,
  log,
}: {
  domain?: string;
  maxSites?: number;
  log: (line: string) => Promise<void> | void;
}): Promise<{ id: string; domain: string; digestSentAt: Date | null }[]> {
  const candidates = await prisma.site.findMany({
    select: {
      id: true,
      domain: true,
      digestSentAt: true,
      lastProcessedAt: true,
      owner: { select: { plan: true, createdAt: true } },
      summary: true,
    },
    where: domain ? { domain } : queryNextToProcess(),
    take: maxSites,
  });

  await log(
    `Processing ${candidates.length} sites: ${candidates.map((s) => s.domain).join(", ")}`,
  );

  await parallel({ limit: 10 }, candidates, (site) =>
    nextCitationRun({ log, site }),
  );
  await parallel({ limit: 10 }, candidates, (site) =>
    updateBotInsight({ log, site }),
  );
  return candidates;
}

/**
 * Run a citation run for a site.
 *
 * @param log - The log function to use.
 * @param site - The site to run a citation run for.
 * @returns True if the citation run was successful, false otherwise.
 */
async function nextCitationRun({
  log,
  site,
}: {
  log: (line: string) => Promise<void> | void;
  site: {
    id: string;
    domain: string;
    summary: string;
  };
}): Promise<boolean> {
  const queries = await prisma.siteQuery.findMany({
    orderBy: [{ group: "asc" }, { query: "asc" }],
    select: { query: true, group: true },
    where: { siteId: site.id },
  });
  await parallel(
    { limit: 10 },
    PLATFORMS,
    async ({ name: platform, model, queryFn }) => {
      try {
        await runPlatform({ log, model, platform, queries, queryFn, site });
      } catch (error) {
        captureAndLogError(error, {
          extra: { siteId: site.id, platform, step: "citation-run" },
        });
      }
    },
  );

  await upsertCitingPages({ log, site });

  await log(`Citation run done for ${site.domain}`);
  await prisma.site.update({
    where: { id: site.id },
    data: { lastProcessedAt: new Date() },
  });

  return true;
}

/**
 * Update the bot insight for a site.
 *
 * It loads the bot visits for the last 7 days and generates a bot insight
 * report.
 *
 * @param log - The log function to use.
 * @param site - The site to update the bot insight for.
 * @returns True if the bot insight was updated successfully, false otherwise.
 */
async function updateBotInsight({
  log,
  site,
}: {
  log: (line: string) => Promise<void> | void;
  site: {
    id: string;
    domain: string;
  };
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
    await log(`Bot insight done for ${site.domain}`);
    return true;
  } catch (error) {
    captureAndLogError(error, { extra: { site } });
    return false;
  }
}
