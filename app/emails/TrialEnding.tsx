import { Temporal } from "@js-temporal/polyfill";
import { Section, Text } from "@react-email/components";
import prices from "~/data/stripe-prices.json";
import prisma from "~/lib/prisma.server";
import EmailLayout from "./EmailLayout";
import { sendEmail } from "./sendEmails";

export default async function sendTrialEndingEmails(trialDays: number) {
  // Send trial-ending emails to users whose trial ends in ~2 days
  const trialEndingSoon = new Date(
    Temporal.Now.instant().subtract({ hours: (trialDays - 2) * 24 })
      .epochMilliseconds,
  );
  const trialEndingSoonCutoff = new Date(
    Temporal.Now.instant().subtract({ hours: (trialDays - 3) * 24 })
      .epochMilliseconds,
  );

  const trialEndingUsers = await prisma.user.findMany({
    where: {
      createdAt: { gte: trialEndingSoonCutoff, lte: trialEndingSoon },
      account: null,
    },
    include: {
      ownedSites: {
        take: 1,
        select: {
          id: true,
          domain: true,
          _count: { select: { citationRuns: true } },
        },
      },
    },
  });

  for (const user of trialEndingUsers) {
    const site = user.ownedSites[0];
    if (!site || user.unsubscribed) continue;
    const citationCount = await countSiteCitations(site.id);
    await sendTrialEndingEmail({
      user,
      citationCount,
      domain: site.domain,
    });
  }
}

async function sendTrialEndingEmail({
  user,
  citationCount,
  domain,
}: {
  user: { id: string; email: string; unsubscribed: boolean };
  citationCount: number;
  domain: string;
}): Promise<{ id: string } | null> {
  return await sendEmail({
    canUnsubscribe: true,
    subject: "Your cite.me.in trial ends in 2 days",
    user,
    render: ({ subject, unsubscribeURL }) => (
      <TrialEndingEmail
        subject={subject}
        unsubscribeURL={unsubscribeURL}
        citationCount={citationCount}
        domain={domain}
      />
    ),
  });
}

function TrialEndingEmail({
  subject,
  unsubscribeURL,
  citationCount,
  domain,
}: {
  subject: string;
  unsubscribeURL?: string;
  citationCount: number;
  domain: string;
}) {
  return (
    <EmailLayout subject={subject} unsubscribeURL={unsubscribeURL}>
      <Section>
        <Text>Your free trial for {domain} ends in 2 days.</Text>
        <Text>
          So far you've collected {citationCount} citation
          {citationCount !== 1 ? "s" : ""} across ChatGPT, Claude, Gemini, and
          Perplexity. No pressure — just a heads up.
        </Text>
        <Text>
          If you'd like to keep your history and continue daily runs, you can
          upgrade at any time for ${prices.monthlyAmount}/month.
        </Text>
      </Section>
    </EmailLayout>
  );
}

async function countSiteCitations(siteId: string): Promise<number> {
  const queries = await prisma.citationQuery.findMany({
    where: { run: { siteId } },
    select: { citations: true },
  });
  return queries.reduce((sum, q) => sum + q.citations.length, 0);
}
