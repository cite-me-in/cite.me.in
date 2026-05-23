import { Temporal } from "@js-temporal/polyfill";
import { fork, sum } from "radashi";
import type { WeeklyDigestEmailProps } from "~/emails/WeeklyDigest";
import { getDomainMeta } from "~/lib/domainMeta.server";
import envVars from "~/lib/envVars.server";
import getSiteMetrics from "~/lib/getSiteMetrics.server";
import { normalizeDomain } from "~/lib/isSameDomain";
import prisma from "~/lib/prisma.server";
import type { SentimentLabel } from "~/prisma";
import { topCompetitors } from "~/routes/site.$domain_.citations/TopCompetitors";

export async function loadWeeklyDigestMetrics(
  siteId: string,
): Promise<Omit<WeeklyDigestEmailProps, "unsubscribeURL">> {
  const site = await prisma.site.findUniqueOrThrow({
    where: { id: siteId },
    select: {
      id: true,
      domain: true,
      citations: true,
      owner: { select: { id: true, email: true, unsubscribed: true } },
      siteUsers: {
        select: {
          user: { select: { id: true, email: true, unsubscribed: true } },
        },
      },
    },
  });

  const today = Temporal.Now.plainDateISO("UTC");
  const weekStart = today.subtract({ days: 7 }).toJSON();
  const prevWeekStart = today.subtract({ days: 14 }).toJSON();

  const metricsResult = await getSiteMetrics({ siteIds: [siteId] });
  const runs = await prisma.citationQueryRun.findMany({
    where: { siteId, onDate: { gte: prevWeekStart } },
    select: {
      onDate: true,
      platform: true,
      queries: {
        select: { query: true, citations: { select: { url: true } } },
      },
      sentimentLabel: true,
      sentimentSummary: true,
    },
  });
  const [currentRuns, prevRuns] = fork(
    runs,
    ({ onDate }) => onDate >= weekStart,
  );

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

  const allCitations = currentRuns
    .flatMap((r) => r.queries)
    .flatMap((q) => q.citations)
    .map((c) => ({ url: c.url, domain: normalizeDomain(c.url) }))
    .filter((c) => c.domain !== "");
  const { competitors: rawCompetitors } = topCompetitors(allCitations, domain);
  const competitors = await Promise.all(
    rawCompetitors.map(async (competitor) => ({
      ...competitor,
      ...(await getDomainMeta(competitor.domain)),
    })),
  );

  const { owner, siteUsers } = site;
  const sendTo = [owner, ...siteUsers.map((siteUser) => siteUser.user)].filter(
    ({ unsubscribed }) => !unsubscribed,
  );

  const citationsURL = new URL(
    `/site/${domain}/citations`,
    envVars.VITE_APP_URL,
  ).toString();

  const humanVisits = await prisma.humanVisit.findMany({
    where: { date: { gte: new Date(weekStart) }, siteId },
    select: {
      aiReferral: true,
      count: true,
      visitorId: true,
    },
  });
  const botVisits = await prisma.botVisit.findMany({
    where: { date: { gte: new Date(weekStart) }, siteId },
    select: {
      count: true,
      botType: true,
    },
  });

  const botPageViews = sum(botVisits, (d) => d.count);
  const humanPageViews = sum(humanVisits, (d) => d.count);
  const humanUniqueVisitors = new Set(
    humanVisits.map(({ visitorId }) => visitorId),
  ).size;
  const botUniqueVisitors = new Set(botVisits.map(({ botType }) => botType))
    .size;
  const allPageViews = humanPageViews + botPageViews;
  const visits = {
    pageViews: allPageViews,
    uniqueVisitors: humanUniqueVisitors + botUniqueVisitors,
    aiReferredVisitors:
      humanUniqueVisitors > 0
        ? sum(humanVisits, ({ aiReferral }) => (aiReferral ? 1 : 0)) /
          humanUniqueVisitors
        : 0,
    botVisits: allPageViews > 0 ? botPageViews / allPageViews : 0,
  };

  return {
    site,
    queryCoverageRate: {
      current: metrics.queryCoverageRate.current,
      previous: metrics.queryCoverageRate.previous,
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
    sendTo,
    topQueries,
    visits,
  };
}
