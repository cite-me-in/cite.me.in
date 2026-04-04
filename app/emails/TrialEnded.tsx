import { Section, Text } from "@react-email/components";
import prices from "~/data/stripe-prices.json";
import { daysAgo } from "~/lib/formatDate";
import prisma from "~/lib/prisma.server";
import { sendEmail } from "./sendEmails";

export default async function sendTrialEndedEmails() {
  const users = await prisma.user.findMany({
    where: {
      createdAt: { lte: daysAgo(25) },
      account: null,
      sentEmails: { none: { type: "TrialEnded" } },
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
    const result = await sendTrialEndedEmail({
      user,
      citationCount,
      domain: site.domain,
      queryCount: site._count.citationRuns,
    });
    if (result)
      await prisma.sentEmail.create({ data: { userId: user.id, type: "TrialEnded" } });
  }
}

async function sendTrialEndedEmail({
  user,
  citationCount,
  domain,
  queryCount,
}: {
  user: { id: string; email: string; unsubscribed: boolean };
  citationCount: number;
  domain: string;
  queryCount: number;
}): Promise<{ id: string } | null> {
  return await sendEmail({
    canUnsubscribe: true,
    subject: "Your cite.me.in data is waiting",
    user,
    email: (
      <Section>
        <Text>
          Over the last 25 days, you tracked {citationCount} citation
          {citationCount !== 1 ? "s" : ""} for {domain} across {queryCount}{" "}
          {queryCount !== 1 ? "queries" : "query"}.
        </Text>
        <Text>
          Your free trial has ended and daily runs have paused. Upgrade to Pro
          to keep your history and resume monitoring — ${prices.monthlyAmount}
          /month or ${prices.annualAmount}/year.
        </Text>
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
