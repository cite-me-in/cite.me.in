import { Button, CodeInline, Section, Text } from "@react-email/components";
import EmailLayout from "./EmailLayout";
import { sendEmail } from "./sendEmails";

export default async function sendEmailVerificationEmail({
  to,
  url,
}: {
  to: string;
  url: string;
}) {
  await sendEmail({
    canUnsubscribe: false,
    to,
    subject: "Verify your email address for cite.me.in",
    render: ({ subject }) => <EmailVerification subject={subject} url={url} />,
  });
}

function EmailVerification({
  subject,
  url: verificationUrl,
}: {
  subject: string;
  url: string;
}) {
  return (
    <EmailLayout subject={subject}>
      <Text className="my-4 text-base text-text leading-relaxed">
        Hello there,
      </Text>

      <Text className="my-4 text-base text-text leading-relaxed">
        You recently requested to change your email address on cite.me.in. To
        complete this change, please verify your new email address by clicking
        the button below.
      </Text>

      <Section className="my-8 text-center">
        <Button
          href={verificationUrl}
          className="rounded-md bg-primary px-4 py-2 text-white hover:bg-primary-hover"
        >
          Verify Email Address
        </Button>
      </Section>

      <Text className="my-4 text-base text-text leading-relaxed">
        Or copy and paste this link into your browser:
      </Text>

      <CodeInline className="line-height-1.5 break-all rounded-md bg-highlightBg p-2 font-mono text-dark text-sm">
        {verificationUrl}
      </CodeInline>

      <Text className="my-4 text-base text-text leading-relaxed">
        This link will expire in 24 hours. If you didn't request this change,
        you can safely ignore this email.
      </Text>

      <Text className="my-4 text-base text-text leading-relaxed">
        Best regards,
        <br />
        The Cite.me.in Team
      </Text>
    </EmailLayout>
  );
}
