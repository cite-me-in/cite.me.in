import { Button, Section, Text } from "@react-email/components";
import EmailLayout from "./EmailLayout";
import { sendEmail } from "./sendEmails";

export default async function sendSiteInvitationEmail({
  email,
  siteDomain,
  invitedByEmail,
  url,
}: {
  email: string;
  siteDomain: string;
  invitedByEmail: string;
  url: string;
}) {
  await sendEmail({
    canUnsubscribe: false,
    render: ({ subject }) => (
      <SiteInvitationEmail
        subject={subject}
        siteDomain={siteDomain}
        invitedByEmail={invitedByEmail}
        url={url}
      />
    ),
    subject: `${invitedByEmail} invited you to ${siteDomain} on Cite.me.in`,
    user: { email, unsubscribed: false },
  });
}

function SiteInvitationEmail({
  subject,
  siteDomain,
  invitedByEmail,
  url,
}: {
  subject: string;
  siteDomain: string;
  invitedByEmail: string;
  url: string;
}) {
  return (
    <EmailLayout subject={subject}>
      <Text className="my-4 text-base text-text leading-relaxed">Hello,</Text>
      <Text className="my-4 text-base text-text leading-relaxed">
        {invitedByEmail} has invited you to join <strong>{siteDomain}</strong>{" "}
        on Cite.me.in.
      </Text>
      <Section className="my-8 text-center">
        <Button
          href={url}
          className="rounded-md bg-primary px-4 py-2 text-white hover:bg-primary-hover"
        >
          Accept Invitation
        </Button>
      </Section>
      <Text className="my-4 text-base text-text leading-relaxed">
        This invitation expires in 7 days. If you don't have an account yet,
        you'll be asked to create one.
      </Text>
      <Text className="my-4 text-base text-text leading-relaxed">
        Best regards,
        <br />
        The Cite.me.in Team
      </Text>
    </EmailLayout>
  );
}
