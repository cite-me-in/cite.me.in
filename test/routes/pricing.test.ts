import { expect } from "@playwright/test";
import { beforeEach, describe, it } from "vite-plus/test";
import prisma from "~/lib/prisma.server";
import { goto } from "~/test/helpers/launchBrowser";
import { port } from "~/test/helpers/launchServer";
import { signIn } from "~/test/helpers/signIn";

const EMAIL_A = "pricing-flow-a@example.com";
const EMAIL_B = "pricing-flow-b@example.com";
const PASSWORD = "password123";

async function fillSignUp(page: import("playwright").Page, email: string) {
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(email);
  await page
    .getByRole("textbox", { name: "Password", exact: true })
    .fill(PASSWORD);
  await page
    .getByRole("textbox", { name: "Confirm password", exact: true })
    .fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
}

describe("pricing user flows", () => {
  describe("flow A: sign up, free tier, upgrade page", () => {
    beforeEach(async () => {
      await prisma.user.deleteMany({
        where: { email: { in: [EMAIL_A, EMAIL_B] } },
      });
    });

    it("should sign up, land on /sites as free-tier user, and show upgrade page", async () => {
      const page = await goto("/sign-up");
      await fillSignUp(page, EMAIL_A);
      await page.waitForURL(`http://localhost:${port}/sites`);
      expect(new URL(page.url()).pathname).toBe("/sites");

      // No account record means free tier
      const user = await prisma.user.findUniqueOrThrow({
        where: { email: EMAIL_A },
      });
      const account = await prisma.account.findUnique({
        where: { userId: user.id },
      });
      expect(account).toBeNull();

      await signIn(user.id);
      const upgradePage = await goto("/upgrade");

      await expect(
        upgradePage.getByRole("heading", { name: "Upgrade to Pro" }),
      ).toBeVisible();
      await expect(
        upgradePage.getByRole("button", { name: /Subscribe — \$\d+\/month/ }),
      ).toBeVisible();
    });

    it("should show Subscribe buttons with correct form structure", async () => {
      const user = await prisma.user.create({
        data: { email: EMAIL_A, passwordHash: "testhash" },
      });
      await signIn(user.id);
      const page = await goto("/upgrade");

      await expect(
        page.getByRole("button", { name: /Subscribe — \$\d+\/month/ }),
      ).toBeVisible();

      // Verify the monthly form posts interval=monthly
      const monthlyForm = page.locator("form", {
        has: page.locator('input[name="interval"][value="monthly"]'),
      });
      await expect(monthlyForm).toBeAttached();
    });

    it("should redirect /upgrade to /sites once account is active", async () => {
      const user = await prisma.user.create({
        data: { email: EMAIL_A, passwordHash: "testhash" },
      });
      await prisma.user.update({
        where: { id: user.id },
        data: {
          plan: "paid",
        },
      });
      await prisma.account.create({
        data: {
          userId: user.id,
          stripeCustomerId: "cus_test_fake",
          stripeSubscriptionId: "sub_test_fake",
          interval: "monthly",
        },
      });

      await signIn(user.id);
      const page = await goto("/upgrade");
      await page.waitForURL(`http://localhost:${port}/sites`);
      expect(new URL(page.url()).pathname).toBe("/sites");
    });
  });

  describe("flow B: home → pricing → get started → sign up → upgrade", () => {
    it("should show the pricing page with three tier cards", async () => {
      const page = await goto("/pricing");

      await expect(
        page.getByRole("heading", { name: "Pricing" }),
      ).toBeVisible();
      await expect(page.getByText("Free Trial", { exact: true })).toBeVisible();
      await expect(page.getByText("Pro", { exact: true })).toBeVisible();
      await expect(page.getByText("Custom", { exact: true })).toBeVisible();
    });

    it("should navigate from home page to pricing page", async () => {
      const page = await goto("/");

      // Pricing is in the footer, not the nav
      await page.getByRole("link", { name: "Pricing" }).click();
      await page.waitForURL(`http://localhost:${port}/pricing`);
      expect(new URL(page.url()).pathname).toBe("/pricing");
    });

    it("should navigate from pricing Get Started to sign-up with next=/upgrade", async () => {
      const page = await goto("/pricing");

      await page.getByRole("link", { name: "Get started" }).click();
      await page.waitForURL(/\/sign-up/);

      const url = new URL(page.url());
      expect(url.pathname).toBe("/sign-up");
      expect(url.searchParams.get("next")).toBe("/upgrade");
    });

    it("should sign up from pricing and land on /upgrade", async () => {
      const page = await goto("/sign-up?next=/upgrade");
      await fillSignUp(page, EMAIL_B);
      await page.waitForURL(`http://localhost:${port}/upgrade`);
      expect(new URL(page.url()).pathname).toBe("/upgrade");

      await expect(
        page.getByRole("heading", { name: "Upgrade to Pro" }),
      ).toBeVisible();
    });
  });
});
