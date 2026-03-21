import { Temporal } from "@js-temporal/polyfill";
import { Column, Img, Link, Row, Section, Text } from "@react-email/components";
import { sample, sortBy, sumBy } from "es-toolkit";
import { twMerge } from "tailwind-merge";
import calculateVisibilityScore from "~/lib/llm-visibility/calculateVisibilityScore";
import prisma from "~/lib/prisma.server";
import { formatDateMed } from "~/lib/temporal";
import { generateCitationChart } from "~/lib/weeklyDigest.server";
import type { SentimentLabel } from "~/prisma";
import EmailLayout from "./EmailLayout";
import { sendEmail } from "./sendEmails";

type WeeklyDigestEmailProps = {
  botVisits: { total: number; delta: number };
  byPlatform: {
    [k: string]: {
      count: number;
      sentimentLabel: SentimentLabel;
      sentimentSummary: string;
    };
  };
  chartBase64: string;
  citations: { delta: number; total: number; domain: number };
  domain: string;
  score: { current: number; delta: number };
  subject: string;
  topQueries: { query: string; count: number; delta: number }[];
  unsubscribeURL?: string;
};

export async function loadWeeklyDigestMetrics(
  siteId: string,
): Promise<WeeklyDigestEmailProps & { to: string[]; subject: string }> {
  const { domain, owner, siteUsers } = await prisma.site.findUniqueOrThrow({
    where: { id: siteId },
    select: {
      domain: true,
      owner: { select: { email: true } },
      siteUsers: { select: { user: { select: { email: true } } } },
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

  const to = [owner.email, ...siteUsers.map((su) => su.user.email)];
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

export default async function sendWeeklyDigestEmail({
  chartBase64,
  domain,
  citations,
  score,
  botVisits,
  topQueries,
  user,
  subject,
  byPlatform,
}: WeeklyDigestEmailProps & {
  user: { id: string; email: string; unsubscribed: boolean };
}): Promise<{ id: string } | null> {
  return await sendEmail({
    canUnsubscribe: true,
    render: ({ subject, unsubscribeURL }) => (
      <WeeklyDigestEmail
        botVisits={botVisits}
        byPlatform={byPlatform}
        chartBase64={chartBase64}
        citations={citations}
        domain={domain}
        score={score}
        subject={subject}
        topQueries={topQueries}
        unsubscribeURL={unsubscribeURL}
      />
    ),
    subject,
    user,
  });
}

export function WeeklyDigestEmail({
  botVisits,
  byPlatform,
  chartBase64,
  citations,
  domain,
  score,
  subject,
  topQueries,
  unsubscribeURL,
}: WeeklyDigestEmailProps) {
  return (
    <EmailLayout subject={subject} unsubscribeURL={unsubscribeURL}>
      <Text className="mb-4 text-center font-bold font-mono text-dark">
        <Link href={`https://${domain}`} className="text-dark">
          {domain}
        </Link>
      </Text>

      <TopMetrics citations={citations} score={score} botVisits={botVisits} />
      <PlatformBreakdown byPlatform={byPlatform} />

      {/* Trend chart */}
      <Section className="my-6">
        <Img
          src={`data:image/png;base64,${chartBase64}`}
          width="560"
          alt="Citation trend: this week vs previous week"
          className="mx-auto block"
        />
        <Text className="mt-1 text-center text-light text-xs">
          — This week &nbsp;&nbsp; - - Previous week
        </Text>
      </Section>

      {/* Top queries */}
      <TopQueries topQueries={topQueries} />
      <SentimentBreakdown byPlatform={byPlatform} />
    </EmailLayout>
  );
}

function TopMetrics({
  citations,
  score,
  botVisits,
}: {
  citations: {
    total: number;
    delta: number;
    domain: number;
  };
  score: { current: number; delta: number };
  botVisits: { total: number; delta: number };
}) {
  return (
    <Section className="my-6">
      <Row>
        {[
          {
            label: "Your citations",
            value: citations.domain,
            delta: citations.delta,
          },
          {
            label: "All citations",
            value: citations.total,
            delta: 0,
          },
          {
            label: "Score",
            value: score.current,
            delta: score.delta,
          },
          {
            label: "Bot visits",
            value: botVisits.total,
            delta: botVisits.delta,
          },
        ].map((item) => (
          <Column key={item.label} className="w-1/4 p-2 text-center">
            <Text className="mb-0 font-bold text-2xl text-dark">
              {item.value.toLocaleString()}
            </Text>
            <Text className="my-1 text-light text-xs">{item.label}</Text>
            <Text
              className="my-0 font-semibold text-xs"
              style={{ color: deltaColor(item.delta) }}
            >
              {deltaValue(item.delta)}
            </Text>
          </Column>
        ))}
      </Row>
    </Section>
  );
}

function PlatformBreakdown({
  byPlatform,
}: {
  byPlatform: Record<
    string,
    {
      count: number;
      sentimentLabel: SentimentLabel;
      sentimentSummary: string;
    }
  >;
}) {
  return (
    <DarkBackground>
      {sortBy(Object.entries(byPlatform), [0])
        .slice(0, 4)
        .map(([platform, { count }]) => (
          <Column key={platform} className="w-1/4 p-2 text-center">
            <Text className="my-0 font-bold text-2xl text-dark">
              {count.toLocaleString()}
            </Text>
            <Text className="my-1 text-light text-xs">{platform}</Text>
          </Column>
        ))}
    </DarkBackground>
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
  const platform = sample(
    Object.values(byPlatform).filter((p) => p.sentimentLabel !== null),
  );
  return (
    <DarkBackground>
      <Column className="p-4">
        <Text className="text-right text-dark text-xs">
          sentiment:{" "}
          <span
            className={twMerge(
              "font-bold",
              {
                neutral: "text-gray-500",
                positive: "text-green-500",
                negative: "text-red-500",
                mixed: "text-yellow-500",
              }[platform.sentimentLabel],
            )}
          >
            {platform.sentimentLabel}
          </span>
        </Text>
        <Text className="my-1 text-light text-sm">
          {platform.sentimentSummary ?? "No sentiment analysis available."}
        </Text>
      </Column>
    </DarkBackground>
  );
}

function TopQueries({
  topQueries,
}: {
  topQueries: { query: string; count: number; delta: number }[];
}) {
  return (
    topQueries.length > 0 && (
      <Section className="my-4">
        <Text className="p-4 font-semibold text-dark text-sm">Top Queries</Text>
        {topQueries.map(
          ({
            query,
            count,
            delta,
          }: {
            query: string;
            count: number;
            delta: number;
          }) => (
            <Row key={query} className="border-borderLight border-b">
              <Column className="p-4 text-sm text-text">{query}</Column>
              <Column className="w-24 p-4 text-right text-dark text-sm">
                {count.toLocaleString()}
              </Column>
              <Column
                className="w-16 p-4 text-right font-semibold text-xs"
                style={{ color: deltaColor(delta) }}
              >
                {deltaValue(delta)}
              </Column>
            </Row>
          ),
        )}
      </Section>
    )
  );
}

function DarkBackground({ children }: { children: React.ReactNode }) {
  return (
    <Section className="my-4 rounded-md bg-highlightBg p-4">
      <Row>{children}</Row>
    </Section>
  );
}

function deltaValue(n: number, suffix = ""): string {
  if (n === 0) return "—";
  return n > 0
    ? `+${n.toLocaleString()}${suffix}`
    : `${n.toLocaleString()}${suffix}`;
}

function deltaColor(n: number): string {
  if (n > 0) return "#16a34a";
  if (n < 0) return "#dc2626";
  return "#6b7280";
}
