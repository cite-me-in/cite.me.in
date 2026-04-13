import { pretty, render } from "@react-email/components";
import { ms } from "convert";
import debug from "debug";
import Redis from "ioredis";
import type { Page } from "playwright";
import { retry, sleep } from "radashi";
import { Resend } from "resend";
import invariant from "tiny-invariant";
import { EmailLinkContext } from "~/components/email/context";
import envVars from "~/lib/envVars.server";
import prisma from "~/lib/prisma.server";
import { newContext } from "~/test/helpers/launchBrowser";
import EmailLayout from "./EmailLayout";
import generateUnsubscribeToken from "./generateUnsubscribeToken";

let lastEmailSent: {
  html: string;
  subject: string;
  to: string;
} | null = null;

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
      from: `cite.me.in <${import.meta.env.VITE_EMAIL_FROM}>`,
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
 * We use different processes for sending emails (Vite worker) and for checking
 * on them (test process), so we use Redis to communicate between the two.
 */
let subscriber: Redis | null = null;
let publisher: Redis | null = null;
let redisInitialized = false;

function initRedis() {
  if (process.env.NODE_ENV !== "test") return;
  if (redisInitialized) return;
  redisInitialized = true;

  try {
    subscriber = new Redis(envVars.REDIS_URL);
    publisher = new Redis(envVars.REDIS_URL);
    subscriber.on("error", (err) => logger("Redis subscriber error: %O", err));
    publisher.on("error", (err) => logger("Redis publisher error: %O", err));
    subscriber.on("message", (channel: string, message: unknown) => {
      if (channel === "email:last")
        lastEmailSent = message
          ? (JSON.parse(message as string) as typeof lastEmailSent)
          : null;
    });
    subscriber.subscribe("email:last");
  } catch (error) {
    logger("Failed to initialize Redis: %O", error);
  }
}

/**
 * Get the last email that was sent. This is useful for visual regression
 * testing. It is only available in test mode. This function will block until
 * the email is captured by the parent process.
 *
 * @returns The last email that was sent: page, html, subject, to.
 */
export async function getLastEmailSent(): Promise<{
  html: string;
  page: Page;
  subject: string;
  to: string;
}> {
  initRedis();
  await retry({ times: 10, delay: ms("1s") }, async () => {
    invariant(lastEmailSent, "No email sent");
    return lastEmailSent;
  });

  invariant(lastEmailSent, "No email sent");
  const context = await newContext();
  const page = await context.newPage();
  await page.setContent(lastEmailSent.html, { waitUntil: "load" });
  await page.setViewportSize({ width: 1024, height: 1500 });
  const lastEmail = {
    page,
    html: lastEmailSent.html,
    subject: lastEmailSent.subject,
    to: lastEmailSent.to,
  };

  lastEmailSent = null;
  return lastEmail;
}

/**
 * Capture the last email that was sent. This is used in the parent process to
 * capture the last email that was sent.
 *
 * @param html - The HTML of the email.
 * @param subject - The subject of the email.
 * @param to - The email address of the recipient.
 */
async function captureLastEmail(lastEmail: typeof lastEmailSent) {
  // Set directly for same-process access (test calls sendEmail then getLastEmailSent).
  // Also publish via Redis for cross-process access (server sends, test process reads).
  lastEmailSent = lastEmail;
  initRedis();
  if (publisher)
    await publisher.publish("email:last", JSON.stringify(lastEmail));
}
