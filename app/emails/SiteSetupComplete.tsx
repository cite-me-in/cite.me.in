import { Section, Text } from "@react-email/components";
import { BrandReminderCard } from "~/components/email/BrandReminder";
import Button from "~/components/email/Button";
import Card from "~/components/email/Card";
import PlatformBreakdown from "~/components/email/PlatformBreakdown";
import SentimentBreakdown from "~/components/email/SentimentBreakdown";
import { TopCompetitors } from "~/components/email/TopCompetitors";
import envVars from "~/lib/envVars.server";
import prisma from "~/lib/prisma.server";
import type { SentimentLabel } from "~/prisma";
import { sendEmail } from "./sendEmails";

export type SetupMetrics = {
  totalCitations: number;
  byPlatform: {
    [k: string]: {
      count: number;
      sentimentLabel: SentimentLabel;
      sentimentSummary: string;
    };
  };
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
  metrics,
  sendTo,
}: {
  domain: string;
  metrics: SetupMetrics;
  sendTo: { id: string; email: string; unsubscribed: boolean };
}) {
  const citationsURL = new URL(
    `/site/${domain}/citations`,
    envVars.VITE_APP_URL,
  ).toString();
  await sendEmail({
    domain,
    email: (
      <SiteSetupComplete
        domain={domain}
        citationsURL={citationsURL}
        metrics={metrics}
      />
    ),
    isTransactional: true,
    sendTo: sendTo,
    subject: "Setup complete",
  });
  await prisma.sentEmail.create({
    data: { userId: sendTo.id, type: "SiteSetupComplete" },
  });
}

function SiteSetupComplete({
  citationsURL,
  domain,
  metrics,
}: {
  citationsURL: string;
  domain: string;
  metrics: SetupMetrics;
}) {
  return (
    <Section>
      <Text className="my-4 text-base text-text leading-relaxed">
        Your site <strong>{domain}</strong> has been set up on cite.me.in.
      </Text>

      <Text className="my-4 text-base text-text leading-relaxed">
        We've crawled your site, generated search queries, and checked how
        ChatGPT, Claude, Copilot, and Gemini cite you. Here's what we found.
      </Text>

      <PlatformBreakdown byPlatform={metrics.byPlatform} />
      <Section className="my-8 text-center">
        <Button href={citationsURL}>View your citations</Button>
      </Section>

      <SetupTopQueries topQueries={metrics.topQueries} />
      <SentimentBreakdown byPlatform={metrics.byPlatform} />
      <TopCompetitors competitors={metrics.competitors} />
      <BrandReminderCard domain={domain} citations={metrics.totalCitations} />

      <Text className="my-4 text-base text-text leading-relaxed">
        Best regards,
        <br />
        The Cite.me.in Team
      </Text>
    </Section>
  );
}

function SetupTopQueries({
  topQueries,
}: {
  topQueries: { query: string; count: number }[];
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
