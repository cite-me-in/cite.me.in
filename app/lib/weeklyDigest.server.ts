import { Temporal } from "@js-temporal/polyfill";
import { sumBy } from "es-toolkit";
import type { WeeklyDigestEmailProps } from "~/emails/WeeklyDigest";
import calculateVisibilityScore from "~/lib/llm-visibility/calculateVisibilityScore";
import prisma from "~/lib/prisma.server";
import { formatDateMed } from "./temporal";

export async function loadWeeklyDigestMetrics(
  siteId: string,
): Promise<WeeklyDigestEmailProps> {
  const { domain, owner, siteUsers } = await prisma.site.findUniqueOrThrow({
    where: { id: siteId },
    select: {
      domain: true,
      owner: { select: { email: true, unsubscribed: true } },
      siteUsers: {
        select: { user: { select: { email: true, unsubscribed: true } } },
      },
    },
  });

  const todayMidnight = Temporal.Now.zonedDateTimeISO("UTC")
    .startOfDay()
    .toInstant();
  const prevWeekStart = new Date(
    todayMidnight.subtract({ hours: 24 * 14 }).epochMilliseconds,
  ).toISOString();
  const weekStart = new Date(
    todayMidnight.subtract({ hours: 24 * 7 }).epochMilliseconds,
  ).toISOString();
  const weekEnd = new Date(todayMidnight.epochMilliseconds).toISOString();

  const [currentRuns, prevRuns, currentVisits, prevVisits] = await Promise.all([
    prisma.citationQueryRun.findMany({
      where: { siteId, onDate: { gte: weekStart, lt: weekEnd } },
      select: {
        onDate: true,
        platform: true,
        queries: {
          select: { query: true, citations: true, position: true, text: true },
        },
        sentimentLabel: true,
        sentimentSummary: true,
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

  const byPlatform = Object.fromEntries(
    currentRuns.map((r) => [
      r.platform,
      {
        count: sumBy(r.queries, (q) => q.citations.length),
        sentimentLabel: r.sentimentLabel ?? "neutral",
        sentimentSummary: r.sentimentSummary ?? "",
      },
    ]),
  );

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

  const chartBase64 = await generateCitationChart(
    dailyCitations,
    prevDailyCitations,
  );

  const to = [owner, ...siteUsers.map((su) => su.user)]
    .filter(({ unsubscribed }) => !unsubscribed)
    .map(({ email }) => email);
  const subject = `Weekly Digest · ${formatDateMed(
    new Date(weekStart),
  )} — ${formatDateMed(new Date(weekEnd))}`;

  return {
    domain,
    to,
    subject,
    citations: {
      delta: currentMetrics.domainCitations - prevMetrics.domainCitations,
      total: currentMetrics.totalCitations,
      domain: currentMetrics.domainCitations,
    },
    byPlatform,
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
    chartBase64,
  };
}

async function generateCitationChart(
  daily: number[],
  prevDaily: number[],
): Promise<string> {
  const { createCanvas } = await import("@napi-rs/canvas");
  const width = 600;
  const height = 200;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const allValues = [...daily, ...prevDaily];
  const maxVal = Math.max(...allValues, 1);

  const xStep = chartWidth / 6;
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  function xAt(i: number) {
    return paddingLeft + i * xStep;
  }
  function yAt(v: number) {
    return paddingTop + chartHeight - (v / maxVal) * chartHeight;
  }

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // Grid lines
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = paddingTop + (i * chartHeight) / 4;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(width - paddingRight, y);
    ctx.stroke();
  }

  // Previous week — gray dashed
  ctx.strokeStyle = "#9ca3af";
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  for (let i = 0; i < 7; i++) {
    const x = xAt(i);
    const y = yAt(prevDaily[i] ?? 0);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Current week — blue solid
  ctx.strokeStyle = "#4f46e5";
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.beginPath();
  for (let i = 0; i < 7; i++) {
    const x = xAt(i);
    const y = yAt(daily[i] ?? 0);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // X-axis labels
  ctx.fillStyle = "#6b7280";
  ctx.font = "11px sans-serif";
  ctx.textAlign = "center";
  for (let i = 0; i < 7; i++) ctx.fillText(days[i] ?? "", xAt(i), height - 8);

  const buffer = canvas.toBuffer("image/png");
  return buffer.toString("base64");
}
