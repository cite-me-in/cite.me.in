import { expect } from "@playwright/test";
import { describe, it } from "vitest";
import prisma from "~/lib/prisma.server";
import { goto, port } from "../helpers/launchBrowser";
import { signIn } from "../helpers/signIn";

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
  describe("flow A: sign up → free tier → purchase subscription", () => {
    it("should sign up and land on /sites as free-tier user", async () => {
      const page = await goto("/sign-up");
      await fillSignUp(page, EMAIL_A);
      await page.waitForURL(`http://localhost:${port}/sites`);
      expect(new URL(page.url()).pathname).toBe("/sites");

      // No account record means free tier
      const user = await prisma.user.findUnique({ where: { email: EMAIL_A } });
      expect(user).not.toBeNull();
      const account = await prisma.account.findUnique({
        where: { userId: user!.id },
      });
      expect(account).toBeNull();
    });

    it("should show the upgrade page after navigating to /upgrade", async () => {
      const user = await prisma.user.findUnique({ where: { email: EMAIL_A } });
      await signIn(user!.id);
      const page = await goto("/upgrade");

      await expect(
        page.getByRole("heading", { name: "Upgrade to Pro" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Subscribe — $29/month" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Subscribe — $249/year" }),
      ).toBeVisible();
    });

    it("should show Subscribe buttons with correct form structure", async () => {
      const user = await prisma.user.findUnique({ where: { email: EMAIL_A } });
      await signIn(user!.id);
      const page = await goto("/upgrade");

      await expect(page.getByRole("button", { name: "Subscribe — $29/month" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Subscribe — $249/year" })).toBeVisible();

      // Verify the monthly form posts interval=monthly
      const monthlyForm = page.locator("form", {
        has: page.locator('input[name="interval"][value="monthly"]'),
      });
      await expect(monthlyForm).toBeAttached();

      // Verify the annual form posts interval=annual
      const annualForm = page.locator("form", {
        has: page.locator('input[name="interval"][value="annual"]'),
      });
      await expect(annualForm).toBeAttached();
    });

    it("should redirect /upgrade to /sites once account is active", async () => {
      const user = await prisma.user.findUnique({ where: { email: EMAIL_A } });
      await prisma.account.create({
        data: {
          userId: user!.id,
          stripeCustomerId: "cus_test_fake",
          stripeSubscriptionId: "sub_test_fake",
          status: "active",
          interval: "monthly",
        },
      });

      await signIn(user!.id);
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
