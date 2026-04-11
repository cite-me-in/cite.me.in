import { createCanvas } from "@napi-rs/canvas";
import { Column, Img, Row, Section, Text } from "@react-email/components";
import { alphabetical, last, map, sort, sum } from "radashi";
import { twMerge } from "tailwind-merge";
import Button from "~/components/email/Button";
import Card from "~/components/email/Card";
import KeyMetrics from "~/components/email/KeyMetric";
import Link from "~/components/email/Link";
import prisma from "~/lib/prisma.server";
import type { SentimentLabel } from "~/prisma";
import { sendEmail } from "./sendEmails";

export type WeeklyDigestEmailProps = {
  domain: string;
  queryCoverageRate: { current: number; previous: number };
  byPlatform: {
    [k: string]: {
      count: number;
      sentimentLabel: SentimentLabel;
      sentimentSummary: string;
    };
  };
  citationTrends: { current: number[]; previous: number[] };
  citations: {
    total: { current: number; previous: number };
    domain: { current: number; previous: number };
  };
  citationsURL: string;
  competitors: {
    domain: string;
    brandName: string;
    url: string;
    count: number;
    pct: number;
  }[];
  score: { current: number; previous: number };
  sendTo: { email: string; unsubscribed: boolean }[];
  siteId: string;
  subject: string;
  topQueries: { query: string; count: number; delta: number }[];
  visits: {
    // Total page views (human + bot)
    pageViews: number;
    // Total unique visitors (human + bot)
    uniqueVisitors: number;
    // Percentage of visitors that are AI-referred
    aiReferredVisitors: number;
    // Percentage of visitors that are bot visits
    botVisits: number;
  };
};

export async function sendSiteDigestEmails(
  data: Omit<WeeklyDigestEmailProps, "unsubscribeURL">,
): Promise<{ id: string }[]> {
  await prisma.site.updateMany({
    where: { id: { in: [data.siteId] } },
    data: { digestSentAt: new Date() },
  });

  const emailIds = await map(
    data.sendTo,
    async (sendTo) =>
      await sendEmail({
        isTransactional: false,
        email: <WeeklyDigestEmail {...data} />,
        subject: data.subject,
        sendTo,
      }),
  );
  return emailIds.filter((emailId) => emailId !== null);
}

export function WeeklyDigestEmail({
  domain,
  queryCoverageRate,
  byPlatform,
  citationTrends,
  citations,
  citationsURL,
  competitors,
  score,
  topQueries,
  visits,
}: WeeklyDigestEmailProps) {
  return (
    <>
      <TopMetrics
        citations={citations}
        score={score}
        queryCoverageRate={queryCoverageRate}
      />
      <PlatformBreakdown byPlatform={byPlatform} />
      <CitationTrendsChart
        current={citationTrends.current}
        previous={citationTrends.previous}
      />
      <TopQueries topQueries={topQueries} />
      <SentimentBreakdown byPlatform={byPlatform} />

      <Section className="my-8 text-center">
        <Button href={citationsURL}>View your citations</Button>
      </Section>

      <TopCompetitors competitors={competitors} />
      <VisitorKeyMetrics
        pageViews={visits.pageViews}
        uniqueVisitors={visits.uniqueVisitors}
        aiReferredVisitors={visits.aiReferredVisitors}
        botVisits={visits.botVisits}
      />
    </>
  );
}

function CitationTrendsChart({
  current,
  previous,
}: {
  current: number[];
  previous: number[];
}) {
  const chartBase64 = generateCitationChart(current, previous);
  const src = `data:image/png;base64,${chartBase64}`;

  return (
    <Card
      title="Citation trends"
      subtitle="Compared to previous week"
      withBorder
    >
      <Row>
        <Column className="px-5 pt-4">
          <Img
            alt="Citation trend: this week vs previous week"
            className="mx-auto block"
            src={src}
            width="520"
            data-slot="chart"
          />
          <Text className="mt-2 text-center text-light text-sm">
            — This week &nbsp;&nbsp; - - Previous week
          </Text>
        </Column>
      </Row>
    </Card>
  );
}

function TopMetrics({
  citations,
  score,
  queryCoverageRate,
}: {
  citations: {
    total: { current: number; previous: number };
    domain: { current: number; previous: number };
  };
  score: { current: number; previous: number };
  queryCoverageRate: { current: number; previous: number };
}) {
  const metrics = [
    { label: "Your citations", ...citations.domain },
    { label: "All citations", ...citations.total },
    { label: "Score", ...score },
    {
      label: "Query Coverage",
      current: `${queryCoverageRate.current}%`,
      previous: queryCoverageRate.previous,
    },
  ];

  return (
    <Card>
      <KeyMetrics metrics={metrics} />
    </Card>
  );
}

function PlatformBreakdown({
  byPlatform,
}: {
  byPlatform: Record<
    string,
    { count: number; sentimentLabel: SentimentLabel; sentimentSummary: string }
  >;
}) {
  const first4 = alphabetical(
    Object.entries(byPlatform),
    ([name]) => name,
  ).slice(0, 4);
  const total = sum(first4, ([, { count }]) => count);
  if (total === 0) return null;

  return (
    <Card title="Citations by platform" className="pb-8">
      <KeyMetrics
        metrics={first4.map(([platform, { count }]) => ({
          label: platform,
          current: `${((count / total) * 100).toFixed(1)}%`,
          count,
        }))}
      />
    </Card>
  );
}

function TopQueries({
  topQueries,
}: {
  topQueries: { query: string; count: number; delta: number }[];
}) {
  if (topQueries.length === 0) return null;
  return (
    <Card
      title="↑ Top queries"
      subtitle="Queries most cited this week"
      withBorder
    >
      <table>
        <thead>
          <tr className="text-center text-light text-xs uppercase tracking-wide">
            <th className="p-4">Query</th>
            <th className="p-4">Citations</th>
            <th className="p-4">Change</th>
          </tr>
        </thead>
        <tbody>
          {topQueries.map(({ query, count, delta }) => (
            <tr key={query} className="border-border border-t">
              <td className="p-4 text-left">{query}</td>
              <td className="p-4 text-center">{count.toLocaleString()}</td>
              <td className={twMerge("p-4 text-center", deltaColor(delta))}>
                {deltaValue(delta)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function SentimentBreakdown({
  byPlatform,
}: {
  byPlatform: Record<
    string,
    { sentimentLabel: SentimentLabel; sentimentSummary: string }
  >;
}) {
  const sentiment = last(
    sort(
      Object.values(byPlatform).filter((p) => p.sentimentSummary.length),
      ({ sentimentLabel }) =>
        ["positive", "mixed", "negative"].indexOf(sentimentLabel),
    ),
  );
  if (!sentiment?.sentimentSummary.length) return null;

  const sentimentColors: Record<SentimentLabel, string> = {
    positive: "text-green-500",
    negative: "text-red-500",
    neutral: "text-gray-500",
    mixed: "text-yellow-500",
  };
  return (
    <Card title="AI sentiment this week" withBorder>
      <Text
        className={twMerge(
          "text-right text-sm uppercase",
          sentimentColors[sentiment.sentimentLabel],
        )}
      >
        {sentiment.sentimentLabel}
      </Text>
      <Text className="text-light text-sm leading-6">
        {sentiment.sentimentSummary ?? "No sentiment analysis available."}
      </Text>
    </Card>
  );
}

function TopCompetitors({
  competitors,
}: {
  competitors: {
    domain: string;
    brandName: string;
    url: string;
    count: number;
    pct: number;
  }[];
}) {
  if (competitors.length === 0) return null;
  return (
    <Card
      title="Top competitors"
      subtitle="Sites appearing in your queries this week"
      withBorder
    >
      <table>
        <tbody>
          {competitors.map(({ domain, brandName, url, count, pct }) => (
            <tr key={domain} className="border-border border-t">
              <td className="w-full py-4">
                <Link href={url} className="text-dark no-underline">
                  {brandName}
                </Link>
              </td>
              <td className="w-30 whitespace-nowrap px-2 py-4 font-bold tabular-nums">
                {count.toLocaleString()}{" "}
                {count === 1 ? "citation" : "citations"}
              </td>
              <td className="w-15 px-2 py-4 text-right tabular-nums">{pct}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function VisitorKeyMetrics({
  pageViews,
  uniqueVisitors,
  aiReferredVisitors,
  botVisits,
}: {
  pageViews: number;
  uniqueVisitors: number;
  aiReferredVisitors: number;
  botVisits: number;
}) {
  const metrics = [
    { label: "Page Views", current: pageViews.toLocaleString() },
    { label: "Unique Visitors", current: uniqueVisitors.toLocaleString() },
    {
      label: "AI-Referred Visitors",
      current: `${(aiReferredVisitors * 100).toFixed(2)}%`,
    },
    { label: "Bot Visits", current: `${(botVisits * 100).toFixed(2)}%` },
  ] as { label: string; current: string }[];
  if (pageViews === 0) return null;

  return (
    <Card>
      <KeyMetrics metrics={metrics} />
    </Card>
  );
}

function generateCitationChart(current: number[], previous: number[]): string {
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

  const allValues = [...current, ...previous];
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
  drawSmoothLine(previous.map((v) => v ?? 0));
  ctx.stroke();

  // Current week — blue solid
  ctx.strokeStyle = "#4f46e5";
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.beginPath();
  drawSmoothLine(current.map((v) => v ?? 0));
  ctx.stroke();

  // X-axis labels
  ctx.fillStyle = "#6b7280";
  ctx.font = "11px sans-serif";
  ctx.textAlign = "center";
  for (let i = 0; i < 7; i++) ctx.fillText(days[i] ?? "", xAt(i), height - 8);

  const buffer = canvas.toBuffer("image/png");
  return buffer.toString("base64");
}

function deltaValue(n: number): string {
  if (n === 0) return "—";
  return n > 0 ? `+${n.toLocaleString()}` : `${n.toLocaleString()}`;
}

function deltaColor(n: number): string {
  if (n > 0) return "text-green-500";
  if (n < 0) return "text-red-500";
  return "text-gray-500";
}
