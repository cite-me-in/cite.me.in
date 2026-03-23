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
  competitors: {
    domain: string;
    brandName: string;
    url: string;
    count: number;
    pct: number;
  }[];
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
  competitors,
  domain,
  score,
  subject,
  topQueries,
  unsubscribeURL,
}: Awaited<ReturnType<typeof loadWeeklyDigestMetrics>>) {
  return (
    <EmailLayout subject={subject} unsubscribeURL={unsubscribeURL}>
      <Text className="text-center font-bold font-mono text-dark">
        <Link href={`https://${domain}`} className="text-dark no-underline">
          {domain}
        </Link>
      </Text>

      <TopMetrics citations={citations} score={score} botVisits={botVisits} />
      <PlatformBreakdown byPlatform={byPlatform} />

      <Card title="Citation trends" subtitle="Compared to previous week">
        <Row>
          <Column className="px-5 pt-4">
            <Img
              alt="Citation trend: this week vs previous week"
              className="mx-auto block"
              src={`data:image/png;base64,${chartBase64}`}
              width="520"
            />
            <Text className="mt-2 text-center text-light text-sm">
              — This week &nbsp;&nbsp; - - Previous week
            </Text>
          </Column>
        </Row>
      </Card>

      <TopQueries topQueries={topQueries} />
      <SentimentBreakdown byPlatform={byPlatform} />
      <TopCompetitors competitors={competitors} />
    </EmailLayout>
  );
}

function TopMetrics({
  citations,
  score,
  botVisits,
}: {
  citations: { total: number; delta: number; domain: number };
  score: { current: number; delta: number };
  botVisits: { total: number; delta: number };
}) {
  const metrics = [
    {
      label: "Your citations",
      value: citations.domain,
      delta: citations.delta,
    },
    { label: "All citations", value: citations.total, delta: 0 },
    { label: "Score", value: score.current, delta: score.delta },
    { label: "Bot visits", value: botVisits.total, delta: botVisits.delta },
  ];

  return (
    <Card>
      <Row>
        {metrics.map((item, i) => (
          <Column
            key={item.label}
            className={twMerge(i < metrics.length - 1 ? "pr-2" : "", "w-1/4")}
          >
            <Section className="w-full overflow-hidden rounded-lg border border-border bg-white">
              <Row>
                <Column className="px-4 text-center">
                  <Text className="mb-1.5 text-light text-xs uppercase tracking-wide">
                    {item.label}
                  </Text>
                  <Text className="font-bold text-2xl text-dark">
                    {item.value.toLocaleString()}
                  </Text>
                  <Text
                    className={twMerge(
                      "text-center font-semibold text-sm",
                      deltaColor(item.delta),
                    )}
                  >
                    {deltaValue(item.delta)}
                  </Text>
                </Column>
              </Row>
            </Section>
          </Column>
        ))}
      </Row>
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
  return (
    <Card>
      <Row>
        {sortBy(Object.entries(byPlatform), [0])
          .slice(0, 4)
          .map(([platform, { count }]) => (
            <Column key={platform} className="w-1/4 px-0 py-4 text-center">
              <Text className="font-bold text-2xl text-dark">
                {count.toLocaleString()}
              </Text>
              <Text className="text-light text-xs uppercase tracking-wide">
                {platform}
              </Text>
            </Column>
          ))}
      </Row>
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
    <Card title="↑ Top queries" subtitle="Queries most cited this week">
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
  const sentiment = sample(
    Object.values(byPlatform).filter(
      (p) => p.sentimentLabel !== null && p.sentimentSummary.length,
    ),
  );
  if (!sentiment) return null;

  const sentimentColors: Record<SentimentLabel, string> = {
    positive: "text-green-500",
    negative: "text-red-500",
    neutral: "text-gray-500",
    mixed: "text-yellow-500",
  };
  return (
    <Card title="AI sentiment this week">
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
              <td className="w-30 whitespace-nowrap py-4 font-bold">
                {count.toLocaleString()}{" "}
                {count === 1 ? "citation" : "citations"}
              </td>
              <td className="w-15 py-4 text-right">{pct}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function Card({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}) {
  return (
    <Section className="my-4 w-full overflow-hidden bg-white">
      {(title || subtitle) && (
        <Row>
          <Column className="px-5 pt-4">
            {title && (
              <Text className="font-bold text-2xl text-dark">{title}</Text>
            )}
            {subtitle && <Text className="text-light text-sm">{subtitle}</Text>}
          </Column>
        </Row>
      )}
      <Row>
        <Column className="px-5 pt-4">{children}</Column>
      </Row>
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
  if (n > 0) return "text-green-500";
  if (n < 0) return "text-red-500";
  return "text-gray-500";
}
