import { Section, Text } from "@react-email/components";
import Button from "~/components/email/Button";
import { brandReminderText } from "~/components/email/BrandReminder";
import prices from "~/data/stripe-prices.json";
import { daysAgo } from "~/lib/formatDate";
import prisma from "~/lib/prisma.server";
import { sendEmail } from "./sendEmails";

export default async function sendTrialEndedEmails() {
  const users = await prisma.user.findMany({
    where: {
      plan: "trial",
      createdAt: { lte: daysAgo(25) },
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
      sendTo: user,
      citationCount,
      domain: site.domain,
      queryCount: site._count.citationRuns,
    });
    if (result)
      await prisma.sentEmail.create({
        data: { userId: user.id, type: "TrialEnded" },
      });
  }
}

async function sendTrialEndedEmail({
  citationCount,
  domain,
  queryCount,
  sendTo,
}: {
  citationCount: number;
  domain: string;
  queryCount: number;
  sendTo: { id: string; email: string; unsubscribed: boolean };
}): Promise<{ id: string } | null> {
  return await sendEmail({
    isTransactional: false,
    subject: "Your cite.me.in data is waiting",
    sendTo: sendTo,
    email: (
      <Section>
        <Text>
          {brandReminderText({ domain, citations: citationCount })} Your free trial has
          ended and daily runs have paused. Upgrade to Pro to keep your history and
          resume monitoring — ${prices.monthlyAmount}/month or ${prices.annualAmount}/year.
        </Text>
        <Section className="my-8 text-center">
          <Button
            href={new URL("/upgrade", import.meta.env.VITE_APP_URL).toString()}
          >
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
