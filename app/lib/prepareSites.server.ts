import { UsageLimitExceededError } from "~/lib/usage/UsageLimitExceededError";
import { Temporal } from "@js-temporal/polyfill";
import { map } from "radashi";
import captureAndLogError from "~/lib/captureAndLogError.server";
import generateBotInsight from "~/lib/llm-visibility/generateBotInsight";
import queryAccount from "~/lib/llm-visibility/queryAccount";
import prisma from "~/lib/prisma.server";
import debug from "debug";

const logger = debug("server");

/**
 * This function is called by the cron job to prepare the sites for the digest
 * email.
 *
 * It returns a list of sites that are eligible for the digest email. These are
 * sites that have not been processed in the last 7 days and are either owned by
 * a user with an active (paid) account or are still in their free trial period.
 *
 * It does a citation run and updates the bot insight for each of these site.
 *
 * @param trialDays The number of days in the free trial period.
 * @returns A list of sites that are eligible for the digest email.
 */
export default async function prepareSites(
  trialDays: number,
): Promise<{ id: string; domain: string; digestSentAt: Date | null }[]> {
  const sitesForDigest = await prisma.site.findMany({
    select: {
      id: true,
      domain: true,
      digestSentAt: true,
    },
    where: {
      digestSentAt: {
        lt: new Date(
          Temporal.Now.instant().subtract({ hours: 7 * 24 }).epochMilliseconds,
        ),
      },
      OR: [
        // Site owner has an active (paid) account.
        { owner: { account: { status: "active" } } },
        // Site owner is still in their free trial period.
        {
          owner: {
            createdAt: {
              gte: new Date(
                Temporal.Now.instant().subtract({ hours: trialDays * 24 })
                  .epochMilliseconds,
              ),
            },
          },
        },
      ],
    },
  });

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
