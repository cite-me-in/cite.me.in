import { ms } from "convert";
import Redis from "ioredis";
import type { Page } from "playwright";
import { retry } from "radashi";
import invariant from "tiny-invariant";
import envVars from "~/lib/envVars.server";
import { newContext } from "./launchBrowser";

export type LastEmailSent = {
  html: string;
  subject: string;
  to: string;
};

/**
 * Get the last email that was sent. This is useful for visual regression
 * testing. It is only available in test mode. This function will block until
 * the email is captured by the parent process.
 *
 * @returns The last email that was sent: page, html, subject, to.
 */
export default async function getLastEmailSent(): Promise<{
  html: string;
  page: Page;
  subject: string;
  to: string;
}> {
  const redis = new Redis(envVars.REDIS_URL);
  let lastEmailSent: LastEmailSent | null = null;
  try {
    return await retry({ times: 10, delay: ms("1s") }, async () => {
      const raw = await redis.get("email:last");
      if (raw) lastEmailSent = JSON.parse(raw) as LastEmailSent;
      invariant(lastEmailSent, "No email sent");

      const context = await newContext();
      const page = await context.newPage();
      await page.setContent(lastEmailSent.html, { waitUntil: "load" });
      await page.setViewportSize({ width: 1024, height: 1500 });
      return {
        page,
        html: lastEmailSent.html,
        subject: lastEmailSent.subject,
        to: lastEmailSent.to,
      };
    });
  } finally {
    await redis.del("email:last");
    await redis.quit();
  }
}
