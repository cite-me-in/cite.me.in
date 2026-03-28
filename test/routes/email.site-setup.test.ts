import { expect } from "@playwright/test";
import { beforeAll, describe, it } from "vitest";
import sendSiteSetupEmail from "~/emails/SiteSetupComplete";
import { getLastEmailSent } from "~/emails/sendEmails";
import { newContext } from "../helpers/launchBrowser";

describe("SiteSetupComplete email", () => {
  let email: NonNullable<Awaited<ReturnType<typeof getLastEmailSent>>>;

  beforeAll(async () => {
    await sendSiteSetupEmail({
      domain: "example.com",
      user: { email: "test@example.com", unsubscribed: false },
    });
    email = await getLastEmailSent();
  });

  it("should send with correct subject", () => {
    expect(email.subject).toBe("example.com is set up on cite.me.in");
  });

  it("should send to correct recipient", () => {
    expect(email.to).toBe("test@example.com");
  });

  it("should match visually", async () => {
    const context = await newContext();
    const page = await context.newPage();
    await page.setContent(email.html, { waitUntil: "load" });
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page).toMatchVisual({ name: "email/site-setup" });
  });
});
