import { expect } from "@playwright/test";
import { beforeAll, describe, it } from "vite-plus/test";
import { getLastEmailSent } from "~/emails/sendEmails";
import { sendTrialEndedEmail } from "~/emails/TrialEnded";
import prisma from "~/lib/prisma.server";

describe("TrialEnded email", () => {
  let email: NonNullable<Awaited<ReturnType<typeof getLastEmailSent>>>;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: "test@example.com",
        passwordHash: "test",
        unsubscribed: false,
      },
    });
    await sendTrialEndedEmail({
      sendTo: user,
      citationCount: 42,
      domain: "example.com",
    });
    email = await getLastEmailSent();
  });

  it("should send with correct subject", () => {
    expect(email.subject).toBe("Your cite.me.in data is waiting");
  });

  it("should send to correct recipient", () => {
    expect(email.to).toBe("test@example.com");
  });

  it("should match visually", async () => {
    await email.page.setViewportSize({ width: 1024, height: 800 });
    await expect(email.page).toMatchVisual({
      name: "email/trial-ended",
    });
  });
});
