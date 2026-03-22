import { Column, Img, Link, Row, Section, Text } from "@react-email/components";
import { sample, sortBy } from "es-toolkit";
import { twMerge } from "tailwind-merge";
import type { loadWeeklyDigestMetrics } from "~/lib/weeklyDigest.server";
import type { SentimentLabel } from "~/prisma";
import EmailLayout from "./EmailLayout";
import { sendEmail } from "./sendEmails";

export type WeeklyDigestEmailProps = {
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
  to: string[];
  topQueries: { query: string; count: number; delta: number }[];
  unsubscribeURL?: string;
};

export async function sendSiteDigestEmails(
  data: WeeklyDigestEmailProps,
): Promise<{ id: string }[]> {
  const emailIds = [];
  for (const to of data.to) {
    const emailId = await sendEmail({
      canUnsubscribe: true,
      render: ({ subject, unsubscribeURL }) => (
        <WeeklyDigestEmail
          {...data}
          subject={subject}
          unsubscribeURL={unsubscribeURL}
        />
      ),
      subject: data.subject,
      user: { email: to, unsubscribed: false },
    });
    if (emailId) emailIds.push(emailId);
  }
  return emailIds;
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
}: Awaited<ReturnType<typeof loadWeeklyDigestMetrics>>) {
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
