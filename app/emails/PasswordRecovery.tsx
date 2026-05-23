import { CodeInline, Section, Text } from "react-email";
import Button from "~/components/email/Button";
import { sendEmail } from "./sendEmails";

export default async function sendPasswordRecoveryEmail({
  email,
  url,
}: {
  email: string;
  url: string;
}) {
  await sendEmail({
    isTransactional: true,
    email: <PasswordRecovery url={url} />,
    subject: "Reset your Cite.me.in password",
    sendTo: { email, unsubscribed: false },
  });
}

function PasswordRecovery({ url: resetPasswordUrl }: { url: string }) {
  return (
    <Section>
      <Text className="text-text my-4 text-base leading-relaxed">
        Hello there,
      </Text>

      <Text className="text-text my-4 text-base leading-relaxed">
        You recently requested to reset your Cite.me.in password. To complete
        this request, please click the button below.
      </Text>

      <Section className="my-8 text-center">
        <Button href={resetPasswordUrl}>Reset Password</Button>
      </Section>

      <Text className="text-text my-4 text-base leading-relaxed">
        Or copy and paste this link into your browser:
      </Text>

      <CodeInline className="line-height-1.5 bg-highlightBg text-dark rounded-md p-2 font-mono text-sm break-all">
        {resetPasswordUrl}
      </CodeInline>

      <Text className="text-text my-4 text-base leading-relaxed">
        This link will expire in 30 minutes. If you didn't request this change,
        you can safely ignore this email.
      </Text>

      <Text className="text-text my-4 text-base leading-relaxed">
        Best regards,
        <br />
        The Cite.me.in Team
      </Text>
    </Section>
  );
}
