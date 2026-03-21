import { Temporal } from "@js-temporal/polyfill";
import { Section, Text } from "@react-email/components";
import prisma from "~/lib/prisma.server";
import EmailLayout from "./EmailLayout";
import { sendEmail } from "./sendEmails";

export default async function sendTrialEndedEmails(trialDays: number) {
  const trialEndedToday = new Date(
    Temporal.Now.instant().subtract({ hours: trialDays * 24 })
      .epochMilliseconds,
  );
  const trialEndedYesterday = new Date(
    Temporal.Now.instant().subtract({ hours: (trialDays - 1) * 24 })
      .epochMilliseconds,
  );

  const trialEndedUsers = await prisma.user.findMany({
    where: {
      createdAt: { gte: trialEndedToday, lte: trialEndedYesterday },
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

  for (const user of trialEndedUsers) {
    const site = user.ownedSites[0];
    if (!site || user.unsubscribed) continue;
    const citationCount = await countSiteCitations(site.id);
    await sendTrialEndedEmail({
      user,
      citationCount,
      domain: site.domain,
      queryCount: site._count.citationRuns,
    });
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
    render: ({ subject, unsubscribeURL }) => (
      <TrialEndedEmail
        subject={subject}
        unsubscribeURL={unsubscribeURL}
        citationCount={citationCount}
        domain={domain}
        queryCount={queryCount}
      />
    ),
  });
}

function TrialEndedEmail({
  subject,
  unsubscribeURL,
  citationCount,
  domain,
  queryCount,
}: {
  subject: string;
  unsubscribeURL?: string;
  citationCount: number;
  domain: string;
  queryCount: number;
}) {
  return (
    <EmailLayout subject={subject} unsubscribeURL={unsubscribeURL}>
      <Section>
        <Text>
          Over the last 25 days, you tracked {citationCount} citation
          {citationCount !== 1 ? "s" : ""} for {domain} across {queryCount}{" "}
          {queryCount !== 1 ? "queries" : "query"}.
        </Text>
        <Text>
          Your free trial has ended and daily runs have paused. Upgrade to Pro
          to keep your history and resume monitoring — $35/month or $320/year.
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
