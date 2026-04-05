import { Section, Text } from "@react-email/components";
import Button from "~/components/email/Button";
import prices from "~/data/stripe-prices.json";
import { daysAgo } from "~/lib/formatDate";
import prisma from "~/lib/prisma.server";
import { sendEmail } from "./sendEmails";

export default async function sendTrialEndingEmails() {
  const users = await prisma.user.findMany({
    where: {
      createdAt: { lte: daysAgo(24) },
      account: null,
      sentEmails: { none: { type: { in: ["TrialEnding", "TrialEnded"] } } },
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

  for (const user of users) {
    const site = user.ownedSites[0];
    if (!site || user.unsubscribed) continue;
    const citationCount = await countSiteCitations(site.id);
    const result = await sendTrialEndingEmail({
      user,
      citationCount,
      domain: site.domain,
    });
    if (result)
      await prisma.sentEmail.create({ data: { userId: user.id, type: "TrialEnding" } });
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
    email: (
      <Section>
        <Text>Your free trial for {domain} ends in 2 days.</Text>
        <Text>
          So far you've collected {citationCount} citation
          {citationCount !== 1 ? "s" : ""} across ChatGPT, Claude, Gemini, and
          Perplexity. No pressure — just a heads up.
        </Text>
        <Text>
          If you'd like to keep your history and continue daily runs, upgrade to
          Pro for ${prices.monthlyAmount}/month.
        </Text>
        <Section className="my-8 text-center">
          <Button href={new URL("/upgrade", import.meta.env.VITE_APP_URL).toString()}>
            Upgrade to Pro
          </Button>
        </Section>
      </Section>
    ),
  });
}

async function countSiteCitations(siteId: string): Promise<number> {
  const queries = await prisma.citationQuery.findMany({
    where: { run: { siteId } },
    select: { citations: true },
  });
  return queries.reduce((sum, q) => sum + q.citations.length, 0);
}
