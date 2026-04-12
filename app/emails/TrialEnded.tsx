import { Section, Text } from "@react-email/components";
import { brandReminderText } from "~/components/email/BrandReminder";
import Button from "~/components/email/Button";
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
        },
      },
    },
  });

  for (const user of users) {
    const site = user.ownedSites[0];
    if (!site || user.unsubscribed) continue;
    const citationCount = await countSiteCitations(site.id);
    await sendTrialEndedEmail({
      sendTo: user,
      citationCount,
      domain: site.domain,
    });
  }
}

export async function sendTrialEndedEmail({
  citationCount,
  domain,
  sendTo,
}: {
  citationCount: number;
  domain: string;
  sendTo: { id: string; email: string; unsubscribed: boolean };
}): Promise<{ id: string } | null> {
  const emailId = await sendEmail({
    isTransactional: false,
    subject: "Your cite.me.in data is waiting",
    sendTo: sendTo,
    email: (
      <Section>
        <Text>
          {brandReminderText({ domain, citations: citationCount })} Your free
          trial has ended and daily runs have paused. Upgrade to Pro to keep
          your history and resume monitoring — ${prices.monthlyAmount}/month or
          ${prices.annualAmount}/year.
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
  await prisma.sentEmail.create({
    data: { userId: sendTo.id, type: "TrialEnded" },
  });
  return emailId;
}

async function countSiteCitations(siteId: string): Promise<number> {
  const queries = await prisma.citationQuery.findMany({
    where: { run: { siteId } },
    select: { citations: true },
  });
  return queries.reduce((sum, q) => sum + q.citations.length, 0);
}
