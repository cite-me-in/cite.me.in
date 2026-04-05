import { Section, Text } from "@react-email/components";
import Button from "~/components/email/Button";
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
    isTransactional: true,
    email: (
      <SiteInvitationEmail
        siteDomain={siteDomain}
        invitedByEmail={invitedByEmail}
        url={url}
      />
    ),
    subject: `${invitedByEmail} invited you to ${siteDomain} on Cite.me.in`,
    sendTo: { email, unsubscribed: false },
  });
}

function SiteInvitationEmail({
  siteDomain,
  invitedByEmail,
  url,
}: {
  siteDomain: string;
  invitedByEmail: string;
  url: string;
}) {
  return (
    <Section>
      <Text className="my-4 text-base text-text leading-relaxed">Hello,</Text>
      <Text className="my-4 text-base text-text leading-relaxed">
        {invitedByEmail} has invited you to join <strong>{siteDomain}</strong>{" "}
        on Cite.me.in.
      </Text>
      <Section className="my-8 text-center">
        <Button href={url}>Accept Invitation</Button>
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
    </Section>
  );
}
