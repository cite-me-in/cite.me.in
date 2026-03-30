import { Button, Section, Text } from "@react-email/components";
import envVars from "~/lib/envVars.server";
import EmailLayout from "./EmailLayout";
import { sendEmail } from "./sendEmails";

export default async function sendSiteSetupEmail({
  domain,
  user,
}: {
  domain: string;
  user: { email: string; unsubscribed: boolean };
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
      />
    ),
    subject: `${domain} is set up on cite.me.in`,
    user,
  });
}

function SiteSetupComplete({
  citationsURL,
  domain,
  subject,
}: {
  citationsURL: string;
  domain: string;
  subject: string;
}) {
  return (
    <EmailLayout subject={subject}>
      <Text className="my-4 text-base text-text leading-relaxed">
        Your site <strong>{domain}</strong> has been set up on cite.me.in.
      </Text>

      <Text className="my-4 text-base text-text leading-relaxed">
        We've crawled your site, generated search queries, and checked how
        ChatGPT, Claude, Perplexity, and Gemini cite you. Your results are
        ready.
      </Text>

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
