import { Temporal } from "@js-temporal/polyfill";
import { sumBy } from "es-toolkit";
import type { WeeklyDigestEmailProps } from "~/emails/WeeklyDigest";
import { getDomainMeta } from "~/lib/domainMeta.server";
import getSiteMetrics from "~/lib/getSiteMetrics.server";
import prisma from "~/lib/prisma.server";
import type { SentimentLabel } from "~/prisma";
import { topCompetitors } from "~/routes/site.$domain_.citations/TopCompetitors";
import { formatDateShort } from "./formatDate";

export async function loadWeeklyDigestMetrics(
  siteId: string,
): Promise<WeeklyDigestEmailProps> {
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
      entry.count += sumBy(run.queries, (q) => q.citations.length);
      if (run.sentimentLabel) {
        entry.sentimentLabel = run.sentimentLabel;
        entry.sentimentSummary = run.sentimentSummary ?? "";
      }
    } else {
      byPlatform[run.platform] = {
        count: sumBy(run.queries, (q) => q.citations.length),
        sentimentLabel: run.sentimentLabel ?? ("neutral" as SentimentLabel),
        sentimentSummary: run.sentimentSummary ?? "",
      };
    }
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

  const allQueries = currentRuns.flatMap((r) => r.queries);
  const { competitors: rawCompetitors } = topCompetitors(allQueries, domain);
  const competitors = await Promise.all(
    rawCompetitors.map(async (competitor) => ({
      ...competitor,
      ...(await getDomainMeta(competitor.domain)),
    })),
  );

  const chartBase64 = await generateCitationChart(
    dailyCitations,
    prevDailyCitations,
  );

  const { owner, siteUsers } = siteInfo;
  const toEmails = [owner, ...siteUsers.map((su) => su.user)]
    .filter(({ unsubscribed }) => !unsubscribed)
    .map(({ email }) => email);
  const subject = `${formatDateShort(new Date(weekStart))} — ${formatDateShort(
    new Date(today.toJSON()),
  )} • ${domain}`;

  return {
    subject,
    toEmails,
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
    byPlatform,
    score: {
      current: metrics.visbilityScore.current,
      previous: metrics.visbilityScore.previous,
    },
    botVisits: {
      current: metrics.botVisits.current,
      previous: metrics.botVisits.previous,
    },
    topQueries,
    competitors,
    chartBase64,
  };
}

export async function generateCitationChart(
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
  function drawSmoothLine(values: number[]) {
    const pts = values.map((v, i) => ({ x: xAt(i), y: yAt(v) }));
    if (pts.length === 0) return;

    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2;
      const my = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  }

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // Grid lines + Y-axis labels
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#6b7280";
  ctx.font = "11px sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let i = 0; i <= 4; i++) {
    const y = paddingTop + (i * chartHeight) / 4;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(width - paddingRight, y);
    ctx.stroke();
    const value = Math.round(maxVal * (1 - i / 4));
    ctx.fillText(String(value), paddingLeft - 4, y);
  }

  // Previous week — gray dashed
  ctx.strokeStyle = "#9ca3af";
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  drawSmoothLine(prevDaily.map((v) => v ?? 0));
  ctx.stroke();

  // Current week — blue solid
  ctx.strokeStyle = "#4f46e5";
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.beginPath();
  drawSmoothLine(daily.map((v) => v ?? 0));
  ctx.stroke();

  // X-axis labels
  ctx.fillStyle = "#6b7280";
  ctx.font = "11px sans-serif";
  ctx.textAlign = "center";
  for (let i = 0; i < 7; i++) ctx.fillText(days[i] ?? "", xAt(i), height - 8);

  const buffer = canvas.toBuffer("image/png");
  return buffer.toString("base64");
}
