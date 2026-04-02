import { Column, Img, Row, Section, Text } from "@react-email/components";
import { alphabetical, last, sort, sum } from "radashi";
import { twMerge } from "tailwind-merge";
import Button from "~/components/email/Button";
import Card from "~/components/email/Card";
import Link from "~/components/email/Link";
import prisma from "~/lib/prisma.server";
import { loadWeeklyDigestMetrics } from "~/lib/weeklyDigest.server";
import type { SentimentLabel } from "~/prisma";
import { sendEmail } from "./sendEmails";

export type WeeklyDigestEmailProps = {
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
  citationsURL: string;
  competitors: {
    domain: string;
    brandName: string;
    url: string;
    count: number;
    pct: number;
  }[];
  score: { current: number; previous: number };
  subject: string;
  toEmails: string[];
  topQueries: { query: string; count: number; delta: number }[];
};

/**
 * Send a digest email to the site owners and site users.
 *
 * @param site The site to send the digest email to.
 * @returns The IDs of the sent emails.
 */
export async function sendSiteDigestEmails(site: {
  id: string;
}): Promise<{ id: string }[]> {
  const data = await loadWeeklyDigestMetrics(site.id);
  await prisma.site.update({
    where: { id: site.id },
    data: { digestSentAt: new Date() },
  });

  const emailIds = [];
  for (const to of data.toEmails) {
    const emailId = await sendEmail({
      canUnsubscribe: true,
      email: <WeeklyDigestEmail {...data} />,
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
}: WeeklyDigestEmailProps) {
  return (
    <>
      <TopMetrics citations={citations} score={score} botVisits={botVisits} />
      <PlatformBreakdown byPlatform={byPlatform} />
      <CitationTrendsChart chartBase64={chartBase64} />
      <TopQueries topQueries={topQueries} />
      <SentimentBreakdown byPlatform={byPlatform} />
      <TopCompetitors competitors={competitors} />
      <Section className="my-8 text-center">
        <Button href={citationsURL}>View your citations</Button>
      </Section>
    </>
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
  const first4 = alphabetical(
    Object.entries(byPlatform),
    ([name]) => name,
  ).slice(0, 4);
  const total = sum(first4, ([, { count }]) => count);

  return (
    <Card title="Citations by platform" className="pb-8">
      <Row>
        {first4.map(([platform, { count }]) => (
          <Column key={platform} className="w-1/4 px-1">
            <Section className="w-full overflow-hidden rounded-lg border border-border bg-white">
              <Row>
                <Column className="px-4 text-center">
                  <Text className="font-bold text-2xl text-dark tabular-nums">
                    {total > 0 ? `${((count / total) * 100).toFixed(1)}%` : "—"}
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
