import { Section, Text } from "@react-email/components";
import EmailLayout from "./EmailLayout";
import { sendEmail } from "./sendEmails";

export default async function sendTrialEndedEmail({
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
