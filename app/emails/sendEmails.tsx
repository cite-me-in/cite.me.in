import { ms } from "convert";
import debug from "debug";
import Redis from "ioredis";
import { sleep } from "radashi";
import { pretty, render } from "react-email";
import { Resend } from "resend";
import { EmailLinkContext } from "~/components/email/context";
import envVars from "~/lib/envVars.server";
import prisma from "~/lib/prisma.server";
import type { LastEmailSent } from "~/test/helpers/getLastEmailSent";
import EmailLayout from "./EmailLayout";
import generateUnsubscribeToken from "./generateUnsubscribeToken";

const resend = new Resend(envVars.RESEND_API_KEY);
const logger = debug("email");

/**
 * Send an email using Resend. If an error occurs, it will be captured by Sentry.
 * The email will be stored in `lastEmailSent` for visual regression testing.
 *
 * @param email - The email to send.
 * @param headers - The headers to send with the email.
 * @param isTransactional - Whether the email is transactional. You can
 * unsubscribe from all emails except for transactional emails.
 * @param sendTo - The email address and unsubscribe status of the recipient.
 * @param subject - The subject of the email.
 * @returns The ID of the email that was sent. If the email is transactional,
 * the ID will be `null`.
 */
export async function sendEmail({
  domain,
  email,
  headers,
  isTransactional,
  sendTo,
  subject,
}: {
  domain?: string;
  email: React.ReactNode;
  headers?: Record<string, string>;
  isTransactional: boolean;
  sendTo: {
    email: string;
    unsubscribed: boolean;
  };
  subject: string;
}): Promise<{
  id: string;
} | null> {
  if (!isTransactional && sendTo.unsubscribed) return null;

  const token = generateUnsubscribeToken(sendTo.email);
  const url = new URL("/unsubscribe", envVars.VITE_APP_URL);
  url.searchParams.set("token", token);
  url.searchParams.set("email", sendTo.email);
  const unsubscribeURL = url.toString();

  const html = await pretty(
    await render(
      <EmailLinkContext.Provider value={{ email: sendTo.email, token }}>
        <EmailLayout
          domain={domain}
          subject={subject}
          unsubscribeURL={!isTransactional && unsubscribeURL}
          user={sendTo}
        >
          {email}
        </EmailLayout>
      </EmailLinkContext.Provider>,
    ),
  );

  // Send bcc copy to all admins
  const admins = await prisma.user.findMany({
    select: { email: true },
    where: { isAdmin: true, email: { not: sendTo.email } },
  });

  // In tests, we don't want to actually send emails, we just want to render them
  if (process.env.NODE_ENV === "test") {
    await captureLastEmail({ html, to: sendTo.email, subject });
    return { id: "test-email-id" };
  } else {
    const { error, data } = await resend.emails.send({
      bcc: admins.map(({ email }) => email),
      from: `cite.me.in <${envVars.VITE_EMAIL_FROM}>`,
      headers: isTransactional
        ? headers
        : {
            ...headers,
            "List-Unsubscribe": `<${unsubscribeURL}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
      html,
      subject,
      to: [sendTo.email],
    });
    if (error) throw error;
    logger("Sent %s to %s", subject, sendTo.email);
    await sleep(ms("1s"));
    return data;
  }
}

/**
 * Capture the last email that was sent. This is used in the parent process to
 * capture the last email that was sent.
 *
 * @param html - The HTML of the email.
 * @param subject - The subject of the email.
 * @param to - The email address of the recipient.
 */
async function captureLastEmail(lastEmail: LastEmailSent) {
  const redis = new Redis(envVars.REDIS_URL);
  await redis.set("email:last", JSON.stringify(lastEmail));
  await redis.quit();
}
