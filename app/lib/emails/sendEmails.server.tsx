import { pretty, render } from "@react-email/components";
import { ms } from "convert";
import debug from "debug";
import { delay, invariant, withTimeout } from "es-toolkit";
import Redis from "ioredis";
import { Resend } from "resend";
import envVars from "~/lib/envVars";

export type LastEmail = {
  html: string;
  subject: string;
  to: string;
};

export let lastEmailSent: LastEmail | undefined = undefined;

const resend = new Resend(envVars.RESEND_API_KEY);
const logger = debug("email");

/**
 * Send an email using Resend. If an error occurs, it will be captured by Sentry.
 * The email will be stored in `lastEmailSent` for visual regression testing.
 *
 * @param renderFn - The function to render the email.
 * @param subject - The subject of the email.
 * @param to - The email address to send the email to.
 * @returns The ID of the email that was sent.
 */
export async function sendEmail({
  render: renderFn,
  subject,
  to,
}: {
  render: ({ subject }: { subject: string }) => React.ReactNode;
  subject: string;
  to: string;
}): Promise<string> {
  lastEmailSent = undefined;
  const html = await pretty(await render(await renderFn({ subject })));
  if (process.env.NODE_ENV === "test")
    await captureLastEmail({ html, to: to, subject });

  // In tests, we don't want to actually send emails, we just want to render them
  if (process.env.NODE_ENV === "test") {
    return "test-email-id";
  } else {
    const { error, data } = await resend.emails.send({
      from: `Cite.me.in <${import.meta.env.VITE_EMAIL_FROM}>`,
      html,
      subject,
      to: [to],
    });
    if (error) throw error;
    logger("%s sent to %s", subject, to);
    return data?.id;
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
    subscriber.on("message", (channel: string, message: unknown) => {
      if (channel === "email:last")
        lastEmailSent = message
          ? (JSON.parse(message as string) as LastEmail)
          : undefined;
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
 * @returns The last email that was sent.
 */
export async function getLastEmailSent(): Promise<LastEmail> {
  initRedis();
  await withTimeout(async () => {
    while (!lastEmailSent) await delay(100);
  }, ms("1s"));
  invariant(lastEmailSent, "No email sent");
  const lastEmail = lastEmailSent;
  lastEmailSent = undefined;
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
async function captureLastEmail(lastEmail: LastEmail) {
  initRedis();
  if (publisher)
    await publisher.publish("email:last", JSON.stringify(lastEmail));
}
