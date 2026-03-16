import { Column, Img, Link, Row, Section, Text } from "@react-email/components";
import type { WeeklyMetrics } from "~/lib/weeklyDigest.server";
import EmailLayout from "./EmailLayout";
import { sendEmail } from "./sendEmails.server";

export default async function sendWeeklyDigestEmail({
  to,
  domain,
  unsubscribeUrl,
  metrics,
  chartBase64,
}: {
  to: string;
  domain: string;
  unsubscribeUrl: string;
  metrics: WeeklyMetrics;
  chartBase64: string;
}) {
  const weekLabel = formatWeekRange(metrics.weekStart, metrics.weekEnd);
  await sendEmail({
    to,
    subject: `Weekly Digest for ${domain} · ${weekLabel}`,
    headers: {
      "List-Unsubscribe": `<${unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    render: ({ subject }) => (
      <WeeklyDigestEmail
        subject={subject}
        domain={domain}
        unsubscribeUrl={unsubscribeUrl}
        metrics={metrics}
        chartBase64={chartBase64}
      />
    ),
  });
}

function formatWeekRange(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const s = start.toLocaleDateString("en-US", opts);
  const e = new Date(end.getTime() - 1).toLocaleDateString("en-US", opts);
  return `${s} — ${e}`;
}

function delta(n: number, suffix = ""): string {
  if (n === 0) return "—";
  return n > 0 ? `+${n}${suffix}` : `${n}${suffix}`;
}

function deltaColor(n: number): string {
  if (n > 0) return "#16a34a";
  if (n < 0) return "#dc2626";
  return "#6b7280";
}

function WeeklyDigestEmail({
  subject,
  domain,
  unsubscribeUrl,
  metrics,
  chartBase64,
}: {
  subject: string;
  domain: string;
  unsubscribeUrl: string;
  metrics: WeeklyMetrics;
  chartBase64: string;
}) {
  return (
    <EmailLayout subject={subject} isCustomer={false}>
      {/* Metric cards */}
      <Section className="my-6">
        <Row>
          <Column className="w-1/4 pr-2 text-center">
            <Text className="mb-0 font-bold text-2xl text-dark">
              {metrics.citations.total}
            </Text>
            <Text className="my-1 text-light text-xs">Total Citations</Text>
            <Text
              className="my-0 font-semibold text-xs"
              style={{ color: deltaColor(metrics.citations.delta) }}
            >
              {delta(metrics.citations.delta)}
            </Text>
          </Column>
          <Column className="w-1/4 pr-2 text-center">
            <Text className="mb-0 font-bold text-2xl text-dark">
              {metrics.score.current}%
            </Text>
            <Text className="my-1 text-light text-xs">Score</Text>
            <Text
              className="my-0 font-semibold text-xs"
              style={{ color: deltaColor(metrics.score.delta) }}
            >
              {delta(metrics.score.delta, "pts")}
            </Text>
          </Column>
          <Column className="w-1/4 pr-2 text-center">
            <Text className="mb-0 font-bold text-2xl text-dark">
              {metrics.botVisits.total.toLocaleString()}
            </Text>
            <Text className="my-1 text-light text-xs">Bot Visits</Text>
            <Text
              className="my-0 font-semibold text-xs"
              style={{ color: deltaColor(metrics.botVisits.delta) }}
            >
              {delta(metrics.botVisits.delta)}
            </Text>
          </Column>
          <Column className="w-1/4 text-center">
            <Text className="mb-0 font-bold text-2xl text-dark">
              {Object.keys(metrics.citations.byPlatform).length}/4
            </Text>
            <Text className="my-1 text-light text-xs">Platforms</Text>
          </Column>
        </Row>
      </Section>

      {/* Platform breakdown */}
      {Object.keys(metrics.citations.byPlatform).length > 0 && (
        <Section className="my-4 rounded-md bg-highlightBg p-4">
          <Text className="mb-2 font-semibold text-dark text-sm">
            Citations by Platform
          </Text>
          <Row>
            {Object.entries(metrics.citations.byPlatform).map(
              ([platform, count]) => (
                <Column key={platform} className="pr-4 text-sm">
                  <Text className="my-0 text-dark">
                    <strong>{platform}:</strong> {count}
                  </Text>
                </Column>
              ),
            )}
          </Row>
        </Section>
      )}

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
      {metrics.topQueries.length > 0 && (
        <Section className="my-4">
          <Text className="mb-2 font-semibold text-dark text-sm">
            Top Queries
          </Text>
          {metrics.topQueries.map(({ query, count, delta: d }) => (
            <Row key={query} className="border-borderLight border-b py-2">
              <Column className="text-sm text-text">{query}</Column>
              <Column className="w-24 text-right text-dark text-sm">
                {count}
              </Column>
              <Column
                className="w-16 text-right font-semibold text-xs"
                style={{ color: deltaColor(d) }}
              >
                {delta(d)}
              </Column>
            </Row>
          ))}
        </Section>
      )}

      {/* Footer */}
      <Section className="mt-8 border-border border-t pt-4">
        <Text className="my-2 text-center text-light text-xs">
          You received this because you're a member of {domain} on Cite.me.in.
          <br />
          <Link href={unsubscribeUrl} className="text-primary underline">
            Unsubscribe from weekly digests
          </Link>
        </Text>
      </Section>
    </EmailLayout>
  );
}
