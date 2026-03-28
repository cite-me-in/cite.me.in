import { Button, Column, Img, Link, Row, Section, Text } from "@react-email/components";
import { sortBy, sumBy } from "es-toolkit";
import { twMerge } from "tailwind-merge";
import type { SentimentLabel } from "~/prisma";
import EmailLayout from "./EmailLayout";
import { sendEmail } from "./sendEmails";

export type WeeklyDigestEmailProps = {
  subject: string;
  citationsURL: string;
  botVisits: { current: number; previous: number };
  byPlatform: {
    [k: string]: {
      count: number;
      sentimentLabel: SentimentLabel;
      sentimentSummary: string;
    };
  };
  chartBase64: string;
  citations: {
    total: { current: number; previous: number };
    domain: { current: number; previous: number };
  };
  score: { current: number; previous: number };
  toEmails: string[];
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
  for (const to of data.toEmails) {
    const emailId = await sendEmail({
      canUnsubscribe: true,
      render: ({ unsubscribeURL }) => (
        <WeeklyDigestEmail {...data} unsubscribeURL={unsubscribeURL} />
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
  citationsURL,
  competitors,
  score,
  topQueries,
  unsubscribeURL,
  subject,
}: WeeklyDigestEmailProps) {
  return (
    <EmailLayout subject={subject} unsubscribeURL={unsubscribeURL}>
      <TopMetrics citations={citations} score={score} botVisits={botVisits} />
      <PlatformBreakdown byPlatform={byPlatform} />
      <CitationTrendsChart chartBase64={chartBase64} />
      <TopQueries topQueries={topQueries} />
      <SentimentBreakdown byPlatform={byPlatform} />
      <TopCompetitors competitors={competitors} />
      <Section className="my-8 text-center">
        <Button
          href={citationsURL}
          className="rounded-md bg-primary px-4 py-2 text-white hover:bg-primary-hover"
        >
          View your citations
        </Button>
      </Section>
    </EmailLayout>
  );
}

function CitationTrendsChart({ chartBase64 }: { chartBase64: string }) {
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
            src={`data:image/png;base64,${chartBase64}`}
            width="520"
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
  botVisits,
}: {
  citations: {
    total: { current: number; previous: number };
    domain: { current: number; previous: number };
  };
  score: { current: number; previous: number };
  botVisits: { current: number; previous: number };
}) {
  const metrics = [
    { label: "Your citations", ...citations.domain },
    { label: "All citations", ...citations.total },
    { label: "Score", ...score },
    { label: "Bot visits", ...botVisits },
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
                  <Text className="mb-1.5 whitespace-nowrap text-light text-xs uppercase tracking-wide">
                    {item.label}
                  </Text>
                  <Text className="font-bold text-2xl text-dark tabular-nums">
                    {item.current.toLocaleString()}
                  </Text>
                  <Text className="flex items-center justify-center gap-1">
                    <span
                      className={twMerge(
                        "text-center font-semibold text-sm",
                        pctDeltaColor(item.current, item.previous),
                      )}
                    >
                      {pctDelta(item.current, item.previous)}
                    </span>
                    <span className="text-light text-xs">
                      {item.previous.toLocaleString()}
                    </span>
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
  const first4 = sortBy(Object.entries(byPlatform), [0]).slice(0, 4);
  const total = sumBy(first4, ([, { count }]) => count);

  return (
    <Card title="Citations by platform" className="pb-8">
      <Row>
        {first4.map(([platform, { count }]) => (
          <Column key={platform} className="w-1/4 px-1">
            <Section className="w-full overflow-hidden rounded-lg border border-border bg-white">
              <Row>
                <Column className="px-4 text-center">
                  <Text className="font-bold text-2xl text-dark tabular-nums">
                    {((count / total) * 100).toFixed(1)}%
                  </Text>
                  <Text className="text-light text-xs uppercase tracking-wide">
                    {platform}
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
  const sentiment = sortBy(
    Object.values(byPlatform).filter((p) => p.sentimentSummary.length),
    [
      ({ sentimentLabel }) =>
        ["positive", "mixed", "negative"].indexOf(sentimentLabel),
    ],
  )[0];
  if (!sentiment) return null;

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

function Card({
  children,
  className,
  title,
  subtitle,
  withBorder,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  withBorder?: boolean;
}) {
  return (
    <Section
      className={twMerge(
        "my-4 w-full overflow-hidden bg-white",
        withBorder && "rounded-lg border border-border",
        className,
      )}
    >
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

function pctDelta(current: number, previous: number): string {
  if (previous === 0) return current === 0 ? "—" : "+∞%";
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return "—";
  return pct > 0 ? `+${pct}%` : `${pct}%`;
}

function pctDeltaColor(current: number, previous: number): string {
  if (current > previous) return "text-green-500";
  if (current < previous) return "text-red-500";
  return "text-gray-500";
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
