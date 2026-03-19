import { Section, Text } from "@react-email/components";
import EmailLayout from "./EmailLayout";
import { sendEmail } from "./sendEmails";

export default async function sendTrialEndingEmail({
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
          upgrade at any time for $35/month.
        </Text>
      </Section>
    </EmailLayout>
  );
}
