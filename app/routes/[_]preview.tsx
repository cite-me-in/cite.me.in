import { Temporal } from "@js-temporal/polyfill";
import { WeeklyDigestEmail } from "~/emails/WeeklyDigest";
import calculateVisibilityScore from "~/lib/llm-visibility/calculateVisibilityScore";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/[_]preview";

export async function loader() {
  const siteId = "cmmi2yfwi000404l9qcci3j0x";
  const domain = "rentail.space";

  const todayMidnight = Temporal.Now.zonedDateTimeISO("UTC")
    .startOfDay()
    .toInstant();

  const weekEnd = new Date(todayMidnight.epochMilliseconds).toISOString();
  const weekStart = new Date(
    todayMidnight.subtract({ hours: 24 * 7 }).epochMilliseconds,
  ).toISOString();
  const prevWeekStart = new Date(
    todayMidnight.subtract({ hours: 24 * 14 }).epochMilliseconds,
  ).toISOString();

  const [currentRuns, prevRuns, currentVisits, prevVisits] = await Promise.all([
    prisma.citationQueryRun.findMany({
      where: { siteId, onDate: { gte: weekStart, lt: weekEnd } },
      select: {
        onDate: true,
        platform: true,
        queries: {
          select: { query: true, citations: true, position: true, text: true },
        },
      },
    }),
    prisma.citationQueryRun.findMany({
      where: { siteId, onDate: { gte: prevWeekStart, lt: weekStart } },
      select: {
        onDate: true,
        platform: true,
        queries: {
          select: { query: true, citations: true, position: true, text: true },
        },
      },
    }),
    prisma.botVisit.aggregate({
      _sum: { count: true },
      where: { siteId, date: { gte: weekStart, lt: weekEnd } },
    }),
    prisma.botVisit.aggregate({
      _sum: { count: true },
      where: { siteId, date: { gte: prevWeekStart, lt: weekStart } },
    }),
  ]);

  const currentMetrics = calculateVisibilityScore({
    domain,
    queries: currentRuns.flatMap((r) => r.queries),
  });
  const prevMetrics = calculateVisibilityScore({
    domain,
    queries: prevRuns.flatMap((r) => r.queries),
  });

  const byPlatform: Record<string, number> = {};
  for (const run of currentRuns) {
    const count = run.queries.flatMap((q) => q.citations).length;
    byPlatform[run.platform] = (byPlatform[run.platform] ?? 0) + count;
  }

  // Daily citations: Mon=0 through Sun=6 (day-of-week relative to weekStart)
  const dailyCitations = Array(7).fill(0) as number[];
  const prevDailyCitations = Array(7).fill(0) as number[];

  for (const run of currentRuns) {
    const dayIndex = Math.floor(
      (new Date(run.onDate).getTime() - new Date(weekStart).getTime()) /
        (1000 * 60 * 60 * 24),
    );
    if (dayIndex >= 0 && dayIndex < 7)
      dailyCitations[dayIndex] += run.queries.flatMap(
        (q) => q.citations,
      ).length;
  }
  for (const run of prevRuns) {
    const dayIndex = Math.floor(
      (new Date(run.onDate).getTime() - new Date(prevWeekStart).getTime()) /
        (1000 * 60 * 60 * 24),
    );
    if (dayIndex >= 0 && dayIndex < 7)
      prevDailyCitations[dayIndex] += run.queries.flatMap(
        (q) => q.citations,
      ).length;
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

  const botVisitsTotal = currentVisits._sum.count ?? 0;
  const botVisitsPrev = prevVisits._sum.count ?? 0;

  return {
    domain,
    weekStart,
    weekEnd,
    citations: {
      total: currentMetrics.domainCitations,
      delta: currentMetrics.domainCitations - prevMetrics.domainCitations,
      byPlatform,
    },
    score: {
      current: Math.round(currentMetrics.visibilityScore),
      delta: Math.round(
        currentMetrics.visibilityScore - prevMetrics.visibilityScore,
      ),
    },
    botVisits: {
      total: botVisitsTotal,
      delta: botVisitsTotal - botVisitsPrev,
    },
    topQueries,
    dailyCitations,
    prevDailyCitations,
  };
}

export default function WeeklyDigest({ loaderData }: Route.MetaArgs) {
  return (
    <WeeklyDigestEmail
      subject="Weekly Digest"
      unsubscribeURL="https://example.com/unsubscribe"
      metrics={loaderData}
      chartBase64="data:image/png;base64,..."
    />
  );
}
