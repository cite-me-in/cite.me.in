import { Button, Column, Link, Row, Section, Text } from "@react-email/components";
import { alphabetical } from "radashi";
import { twMerge } from "tailwind-merge";
import type { SentimentLabel } from "~/prisma";
import envVars from "~/lib/envVars.server";
import EmailLayout from "./EmailLayout";
import { sendEmail } from "./sendEmails";

export type SetupMetrics = {
  totalCitations: number;
  byPlatform: Record<
    string,
    {
      citations: number;
      sentimentLabel: SentimentLabel | null;
      sentimentSummary: string | null;
    }
  >;
  topQueries: { query: string; count: number }[];
  competitors: {
    domain: string;
    brandName: string;
    url: string;
    count: number;
    pct: number;
  }[];
};

export default async function sendSiteSetupEmail({
  domain,
  user,
  metrics,
}: {
  domain: string;
  user: { email: string; unsubscribed: boolean };
  metrics: SetupMetrics;
}) {
  const citationsURL = new URL(
    `/site/${domain}/citations`,
    envVars.VITE_APP_URL,
  ).toString();
  await sendEmail({
    canUnsubscribe: false,
    render: ({ subject }) => (
      <SiteSetupComplete
        subject={subject}
        domain={domain}
        citationsURL={citationsURL}
        metrics={metrics}
      />
    ),
    subject: `${domain} is set up on cite.me.in`,
    user,
  });
}

function SiteSetupComplete({
  citationsURL,
  domain,
  metrics,
  subject,
}: {
  citationsURL: string;
  domain: string;
  metrics: SetupMetrics;
  subject: string;
}) {
  return (
    <EmailLayout subject={subject}>
      <Text className="my-4 text-base text-text leading-relaxed">
        Your site <strong>{domain}</strong> has been set up on cite.me.in.
      </Text>

      <Text className="my-4 text-base text-text leading-relaxed">
        We've crawled your site, generated search queries, and checked how
        ChatGPT, Claude, Perplexity, and Gemini cite you. Here's what we found.
      </Text>

      <PlatformCitations byPlatform={metrics.byPlatform} />
      <SetupTopQueries topQueries={metrics.topQueries} />
      <SetupSentiment byPlatform={metrics.byPlatform} />
      <SetupTopCompetitors competitors={metrics.competitors} />

      <Section className="my-8 text-center">
        <Button
          href={citationsURL}
          className="rounded-md bg-primary px-4 py-2 text-white hover:bg-primary-hover"
        >
          View your citations
        </Button>
      </Section>

      <Text className="my-4 text-base text-text leading-relaxed">
        Best regards,
        <br />
        The Cite.me.in Team
      </Text>
    </EmailLayout>
  );
}

function PlatformCitations({
  byPlatform,
}: {
  byPlatform: SetupMetrics["byPlatform"];
}) {
  const platforms = alphabetical(
    Object.entries(byPlatform),
    ([name]) => name,
  ).slice(0, 4);

  return (
    <Card title="Citations found">
      <Row>
        {platforms.map(([platform, { citations }], i) => (
          <Column
            key={platform}
            className={twMerge(i < platforms.length - 1 ? "pr-2" : "", "w-1/4")}
          >
            <Section className="w-full overflow-hidden rounded-lg border border-border bg-white">
              <Row>
                <Column className="px-4 text-center">
                  <Text className="font-bold text-2xl text-dark tabular-nums">
                    {citations.toLocaleString()}
                  </Text>
                  <Text className="mb-1.5 whitespace-nowrap text-light text-xs uppercase tracking-wide">
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

function SetupTopQueries({
  topQueries,
}: {
  topQueries: SetupMetrics["topQueries"];
}) {
  if (topQueries.length === 0) return null;
  return (
    <Card
      title="↑ Top queries"
      subtitle="Queries most cited in your first run"
      withBorder
    >
      <table>
        <thead>
          <tr className="text-center text-light text-xs uppercase tracking-wide">
            <th className="p-4">Query</th>
            <th className="p-4">Citations</th>
          </tr>
        </thead>
        <tbody>
          {topQueries.map(({ query, count }) => (
            <tr key={query} className="border-border border-t">
              <td className="p-4 text-left">{query}</td>
              <td className="p-4 text-center">{count.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function SetupSentiment({
  byPlatform,
}: {
  byPlatform: SetupMetrics["byPlatform"];
}) {
  const platforms = alphabetical(
    Object.entries(byPlatform).filter(
      ([, { sentimentSummary }]) => sentimentSummary,
    ),
    ([name]) => name,
  );
  if (platforms.length === 0) return null;

  const sentimentColors: Record<SentimentLabel, string> = {
    positive: "text-green-500",
    negative: "text-red-500",
    neutral: "text-gray-500",
    mixed: "text-yellow-500",
  };

  return (
    <Card title="AI sentiment" withBorder>
      {platforms.map(([platform, { sentimentLabel, sentimentSummary }]) => (
        <Section key={platform} className="border-border border-b py-3">
          <Row>
            <Column className="w-1/4">
              <Text className="text-light text-xs uppercase tracking-wide">
                {platform}
              </Text>
              <Text
                className={twMerge(
                  "text-sm font-semibold uppercase",
                  sentimentColors[sentimentLabel ?? "neutral"],
                )}
              >
                {sentimentLabel ?? "neutral"}
              </Text>
            </Column>
            <Column>
              <Text className="text-light text-sm leading-6">
                {sentimentSummary ?? "—"}
              </Text>
            </Column>
          </Row>
        </Section>
      ))}
    </Card>
  );
}

function SetupTopCompetitors({
  competitors,
}: {
  competitors: SetupMetrics["competitors"];
}) {
  if (competitors.length === 0) return null;
  return (
    <Card
      title="Top competitors"
      subtitle="Sites appearing in your queries"
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
              <td className="w-15 px-2 py-4 text-right tabular-nums">
                {pct}%
              </td>
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
            {subtitle && (
              <Text className="text-light text-sm">{subtitle}</Text>
            )}
          </Column>
        </Row>
      )}
      <Row>
        <Column className="px-5 pt-4">{children}</Column>
      </Row>
    </Section>
  );
}
