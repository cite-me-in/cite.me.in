import type { WeeklyDigestEmailProps } from "~/emails/WeeklyDigest";
import type { SentimentLabel } from "~/prisma";
import { formatDateShort } from "./formatDate";
import { topCompetitors } from "~/routes/site.$domain_.citations/TopCompetitors";
import { getDomainMeta } from "~/lib/domainMeta.server";
import { Temporal } from "@js-temporal/polyfill";
import { sum } from "radashi";
import getSiteMetrics from "~/lib/getSiteMetrics.server";
import envVars from "~/lib/envVars.server";
import prisma from "~/lib/prisma.server";

export async function loadWeeklyDigestMetrics(
  siteId: string,
): Promise<Omit<WeeklyDigestEmailProps, "unsubscribeURL">> {
  const today = Temporal.Now.plainDateISO("UTC");
  const weekStart = today.subtract({ days: 7 }).toJSON();
  const prevWeekStart = today.subtract({ days: 14 }).toJSON();

  const [metricsResult, siteInfo, currentRuns, prevRuns] = await Promise.all([
    getSiteMetrics({ siteIds: [siteId] }),
    prisma.site.findUniqueOrThrow({
      where: { id: siteId },
      select: {
        owner: { select: { email: true, unsubscribed: true } },
        siteUsers: {
          select: { user: { select: { email: true, unsubscribed: true } } },
        },
      },
    }),
    prisma.citationQueryRun.findMany({
      where: { siteId, onDate: { gte: weekStart, lt: today.toJSON() } },
      select: {
        onDate: true,
        platform: true,
        queries: { select: { query: true, citations: true } },
        sentimentLabel: true,
        sentimentSummary: true,
      },
    }),
    prisma.citationQueryRun.findMany({
      where: { siteId, onDate: { gte: prevWeekStart, lt: weekStart } },
      select: {
        onDate: true,
        queries: { select: { query: true, citations: true } },
      },
    }),
  ]);

  const metrics = metricsResult[0];
  if (!metrics) throw new Error(`Site not found: ${siteId}`);
  const { domain } = metrics.site;

  const byPlatform: Record<
    string,
    { count: number; sentimentLabel: SentimentLabel; sentimentSummary: string }
  > = {};
  for (const run of currentRuns) {
    const entry = byPlatform[run.platform];
    if (entry) {
      entry.count += sum(run.queries, (q) => q.citations.length);
      if (run.sentimentLabel) {
        entry.sentimentLabel = run.sentimentLabel;
        entry.sentimentSummary = run.sentimentSummary ?? "";
      }
    } else {
      byPlatform[run.platform] = {
        count: sum(run.queries, (q) => q.citations.length),
        sentimentLabel: run.sentimentLabel ?? ("neutral" as SentimentLabel),
        sentimentSummary: run.sentimentSummary ?? "",
      };
    }
  }

  // Daily citations: Mon=0 through Sun=6 (day-of-week relative to weekStart)
  const current = Array(7).fill(0) as number[];
  const previous = Array(7).fill(0) as number[];

  for (const run of currentRuns) {
    const dayIndex = Math.floor(
      (new Date(run.onDate).getTime() - new Date(weekStart).getTime()) /
        (1000 * 60 * 60 * 24),
    );
    if (dayIndex >= 0 && dayIndex < 7)
      current[dayIndex] += run.queries.flatMap((q) => q.citations).length;
  }
  for (const run of prevRuns) {
    const dayIndex = Math.floor(
      (new Date(run.onDate).getTime() - new Date(prevWeekStart).getTime()) /
        (1000 * 60 * 60 * 24),
    );
    if (dayIndex >= 0 && dayIndex < 7)
      previous[dayIndex] += run.queries.flatMap((q) => q.citations).length;
  }

  // Top queries
  const queryCounts: Record<string, { current: number; prev: number }> = {};
  for (const run of currentRuns)
    for (const q of run.queries) {
      queryCounts[q.query] ??= { current: 0, prev: 0 };
      queryCounts[q.query].current += q.citations.length;
    }
  for (const run of prevRuns)
    for (const q of run.queries) {
      queryCounts[q.query] ??= { current: 0, prev: 0 };
      queryCounts[q.query].prev += q.citations.length;
    }

  const topQueries = Object.entries(queryCounts)
    .sort(([, a], [, b]) => b.current - a.current)
    .slice(0, 5)
    .map(([query, { current, prev }]) => ({
      query,
      count: current,
      delta: current - prev,
    }));

  const allQueries = currentRuns.flatMap((r) => r.queries);
  const { competitors: rawCompetitors } = topCompetitors(allQueries, domain);
  const competitors = await Promise.all(
    rawCompetitors.map(async (competitor) => ({
      ...competitor,
      ...(await getDomainMeta(competitor.domain)),
    })),
  );

  const { owner, siteUsers } = siteInfo;
  const toEmails = [owner, ...siteUsers.map((su) => su.user)]
    .filter(({ unsubscribed }) => !unsubscribed)
    .map(({ email }) => email);
  const subject = `${formatDateShort(new Date(weekStart))} — ${formatDateShort(
    new Date(today.toJSON()),
  )} • ${domain}`;

  const citationsURL = new URL(
    `/site/${domain}/citations`,
    envVars.VITE_APP_URL,
  ).toString();

  return {
    botVisits: {
      current: metrics.botVisits.current,
      previous: metrics.botVisits.previous,
    },
    byPlatform,
    citationTrends: { current, previous },
    citations: {
      total: {
        current: metrics.allCitations.current,
        previous: metrics.allCitations.previous,
      },
      domain: {
        current: metrics.yourCitations.current,
        previous: metrics.yourCitations.previous,
      },
    },
    citationsURL,
    competitors,
    score: {
      current: metrics.visbilityScore.current,
      previous: metrics.visbilityScore.previous,
    },
    siteId,
    subject,
    toEmails,
    topQueries,
  };
}
