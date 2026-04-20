import { map } from "radashi";
import { Column, Img, Row, Section, Text } from "react-email";
import { twMerge } from "tailwind-merge";
import { BrandReminderCard } from "~/components/email/BrandReminder";
import Button from "~/components/email/Button";
import Card from "~/components/email/Card";
import KeyMetrics from "~/components/email/KeyMetric";
import PlatformBreakdown from "~/components/email/PlatformBreakdown";
import SentimentBreakdown from "~/components/email/SentimentBreakdown";
import prisma from "~/lib/prisma.server";
import type { SentimentLabel } from "~/prisma";
import { TopCompetitors } from "../components/email/TopCompetitors";
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
  sendTo: { id: string; email: string; unsubscribed: boolean }[];
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

  const emailIds = await map(data.sendTo, async (sendTo) => {
    const emailId = await sendEmail({
      domain: data.domain,
      isTransactional: false,
      email: <WeeklyDigestEmail {...data} />,
      subject: data.subject,
      sendTo,
    });
    await prisma.sentEmail.create({
      data: { user: { connect: { id: sendTo.id } }, type: "WeeklyDigest" },
    });
    return emailId;
  });
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
}: Omit<WeeklyDigestEmailProps, "subject">) {
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
      <BrandReminderCard domain={domain} citations={citations.domain.current} />
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
  const svgBase64 = generateCitationChart(current, previous);
  const src = `data:image/svg+xml;base64,${svgBase64}`;

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
    {
      label: "Query Coverage",
      current: `${queryCoverageRate.current}%`,
      previous: queryCoverageRate.previous,
    },
    {
      label: "Visibility Score",
      current: `${score.current}%`,
      previous: score.previous,
      highlightScore: true,
    },
  ];

  return (
    <Card>
      <KeyMetrics metrics={metrics} />
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

  const xAt = (i: number) => paddingLeft + i * xStep;
  const yAt = (v: number) =>
    paddingTop + chartHeight - (v / maxVal) * chartHeight;

  const toPath = (values: number[]) => {
    const pts = values.map((v, i) => ({ x: xAt(i), y: yAt(v ?? 0) }));
    if (pts.length === 0) return "";
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2;
      const my = (pts[i].y + pts[i + 1].y) / 2;
      d += ` Q ${pts[i].x} ${pts[i].y} ${mx} ${my}`;
    }
    d += ` L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;
    return d;
  };

  let gridLines = "";
  for (let i = 0; i <= 4; i++) {
    const y = paddingTop + (i * chartHeight) / 4;
    const value = Math.round(maxVal * (1 - i / 4));
    gridLines += `<line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" stroke="#e5e7eb" />`;
    gridLines += `<text x="${paddingLeft - 4}" y="${y}" text-anchor="end" dominant-baseline="middle" fill="#6b7280" font-size="11" font-family="sans-serif">${value}</text>`;
  }

  let xLabels = "";
  for (let i = 0; i < 7; i++) {
    xLabels += `<text x="${xAt(i)}" y="${height - 8}" text-anchor="middle" fill="#6b7280" font-size="11" font-family="sans-serif">${days[i]}</text>`;
  }

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}" fill="#ffffff"/>
    ${gridLines}
    <path d="${toPath(previous)}" fill="none" stroke="#9ca3af" stroke-width="2" stroke-dasharray="4,4"/>
    <path d="${toPath(current)}" fill="none" stroke="#4f46e5" stroke-width="2"/>
    ${xLabels}
  </svg>`;

  return Buffer.from(svg).toString("base64");
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
