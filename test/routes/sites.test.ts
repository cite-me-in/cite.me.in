import { type Locator, type Page, expect } from "@playwright/test";
import { ms } from "convert";
import type { BrowserContext } from "playwright";
import { afterAll, beforeAll, describe, it } from "vitest";
import { hashPassword } from "~/lib/auth.server";
import prisma from "~/lib/prisma.server";
import type { Site, User } from "~/prisma";
import { goto } from "~/test/helpers/launchBrowser";
import { signIn } from "~/test/helpers/signIn";

describe("unauthenticated access", () => {
  it("should redirect to /sign-in", async () => {
    const page = await goto("/sites");
    expect(page.url()).toContain("/sign-in");
  });
});

describe("sites route", () => {
  let page: Page;
  let user: User;
  let ctx: BrowserContext;

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        id: "user-sites-test",
        email: "sites-test@example.com",
        passwordHash: await hashPassword("correct-password-123"),
        plan: "paid",
        account: {
          create: {
            id: "account-sites-test",
            stripeCustomerId: "test-stripe-customer-id",
            stripeSubscriptionId: "test-stripe-subscription-id",
            interval: "monthly",
          },
        },
      },
    });
    ctx = await signIn(user.id);
    page = await goto("/sites", ctx);
  });

  describe("empty state", () => {
    it("should show URL input and descriptive text", async () => {
      await expect(page.getByRole("textbox", { name: "Website URL or domain" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Add Site" })).toBeVisible();
      await expect(page.getByText("Enter a full URL")).toBeVisible();
    });

    it("should show add site button", async () => {
      await expect(page.getByRole("button", { name: "Add Site" })).toBeVisible();
    });

    it("should match visually", async () => {
      await expect(page.locator("main")).toMatchVisual({
        name: "sites/empty",
        modify: fixBaseline,
      });
    });
  });

  describe("when user enters invalid URL", () => {
    beforeAll(async () => {
      await page.goto("/sites", { timeout: ms("10s") });
      await page.reload({ waitUntil: "load" });
      await page.waitForFunction(() => document.body.getAttribute("data-hydrated") === "true", {
        timeout: ms("15s"),
      });
      await page.getByRole("textbox", { name: "Website URL or domain" }).fill("http://192.168.1.1");
      await page.getByRole("button", { name: "Add Site" }).click();
    });

    it("should show error for invalid URL", async () => {
      await expect(page.getByText("Enter a valid website URL or domain name")).toBeVisible();
    });
  });

  describe("when user enters localhost URL", () => {
    beforeAll(async () => {
      await page.goto("/sites", { timeout: ms("10s") });
      await page.reload({ waitUntil: "load" });
      await page.waitForFunction(() => document.body.getAttribute("data-hydrated") === "true", {
        timeout: ms("15s"),
      });
      await page.getByRole("textbox", { name: "Website URL or domain" }).fill("localhost");
      await page.getByRole("button", { name: "Add Site" }).click();
    });

    it("should show error for localhost", async () => {
      await expect(page.getByText("Enter a valid website URL or domain name")).toBeVisible();
    });
  });

  describe("when duplicate domain", () => {
    let page: Page;

    beforeAll(async () => {
      await prisma.site.create({
        data: {
          apiKey: "test-api-key-sites-1",
          content: "Test content",
          domain: "duplicate-test.com",
          id: "site-1",
          ownerId: user.id,
          summary: "Test summary",
        },
      });
      page = await ctx.newPage();
      await page.goto("/sites", { timeout: ms("10s") });
      await page.reload({ waitUntil: "load" });
      await page.waitForFunction(() => document.body.getAttribute("data-hydrated") === "true", {
        timeout: ms("15s"),
      });
      await page.getByRole("button", { name: "Add Site" }).click();
      await page.getByRole("textbox", { name: "Website URL or domain" }).fill("duplicate-test.com");
      await page.getByRole("button", { name: "Add Site" }).click();
    });

    it("should redirect to site page", async () => {
      await expect(page).toHaveURL("/site/duplicate-test.com/citations");
    });

    afterAll(async () => {
      await prisma.site.deleteMany();
    });
  });

  describe("when successful save", () => {
    let site: Site;
    let page: Page;

    beforeAll(async () => {
      await prisma.site.deleteMany();

      page = await ctx.newPage();
      await page.goto("/sites", { timeout: ms("10s") });
      await page.reload({ waitUntil: "load" });
      await page.waitForFunction(() => document.body.getAttribute("data-hydrated") === "true", {
        timeout: ms("15s"),
      });
      await page.getByRole("textbox", { name: "Website URL or domain" }).fill("acme.com");
      await page.getByRole("button", { name: "Add Site" }).click();
      await page.waitForURL(/\/site\/[^/]+\/setup/, { timeout: 15_000 });

      site = await prisma.site.findFirstOrThrow({
        where: { domain: "acme.com", ownerId: user.id },
      });
    });

    it("should create site record in DB", async () => {
      expect(site.domain).toBe("acme.com");
    });

    it("should redirect to setup page", async () => {
      expect(new URL(page.url()).pathname).toMatch(`/site/${site.domain}/setup`);
    });

    it("should show setup page heading", async () => {
      await expect(page.getByRole("heading", { name: /Setting up/ })).toBeVisible();
    });
  });

  describe("when site available", () => {
    beforeAll(async () => {
      await prisma.site.deleteMany();
      await prisma.site.create({
        data: {
          apiKey: "test-api-key-sites-dashboard",
          content: "Test content",
          domain: "dashboard-test.com",
          id: "site-dashboard-test",
          ownerId: user.id,
          summary: "Test summary",
        },
      });
      await page.goto("/sites", { timeout: ms("10s") });
      await page.reload({ waitUntil: "load" });
      await page.waitForFunction(() => document.body.getAttribute("data-hydrated") === "true", {
        timeout: ms("15s"),
      });
    });

    it("should show column headers", async () => {
      const container = page.locator('a:has-text("Your citations")').last();
      await expect(container.getByText("Your citations", { exact: true })).toBeVisible();
      await expect(container.getByText("All citations", { exact: true })).toBeVisible();
      await expect(container.getByText("Visibility Score", { exact: true })).toBeVisible();
      await expect(container.getByText("Query Coverage", { exact: true })).toBeVisible();
    });

    it("should match visually", async () => {
      await expect(page.locator("main")).toMatchVisual({
        name: "sites/list",
        modify: fixBaseline,
      });
    });

    describe("when delete button", () => {
      let settingsPage: Page;
      let deleteConfirmBtn: Locator;
      let confirmDomainInput: Locator;
      let count: number;

      beforeAll(async () => {
        count = await prisma.site.count();
        settingsPage = await ctx.newPage();
        await settingsPage.goto("/site/dashboard-test.com/settings", {
          timeout: ms("10s"),
        });
        await settingsPage.reload({ waitUntil: "load" });
        await settingsPage.waitForFunction(
          () => document.body.getAttribute("data-hydrated") === "true",
          { timeout: ms("15s") },
        );
        await settingsPage.getByRole("button", { name: "Delete site" }).click();

        deleteConfirmBtn = settingsPage.getByRole("button", {
          name: "Delete Site",
        });
        confirmDomainInput = settingsPage.getByPlaceholder("dashboard-test.com");
      });

      it("should open confirmation dialog", async () => {
        await expect(settingsPage.getByText("Are you sure you want to delete")).toBeVisible();
      });

      it("should require domain name match", async () => {
        // Initially disabled
        await expect(deleteConfirmBtn).toBeDisabled();
        // Type wrong domain
        await confirmDomainInput.fill("wrong.com");
        await expect(deleteConfirmBtn).toBeDisabled();
      });

      it("should match visually", async () => {
        await expect(settingsPage.locator("main")).toMatchVisual({
          name: "settings/delete",
          modify: fixBaseline,
        });
      });

      describe("when domain matches", () => {
        beforeAll(async () => {
          await confirmDomainInput.fill("dashboard-test.com");
          await expect(deleteConfirmBtn).toBeEnabled();
          await settingsPage.getByRole("button", { name: "Delete Site" }).click();
          await settingsPage.waitForURL("/sites");
        });

        it("should delete site", async () => {
          const updated = await prisma.site.count({
            where: { ownerId: user.id },
          });
          expect(updated).toBe(count - 1);
        });
      });
    });

    afterAll(async () => {
      await prisma.site.deleteMany();
    });
  });

  describe("citation delta states", () => {
    const siteId = "site-delta-test";

    beforeAll(async () => {
      await prisma.site.create({
        data: {
          apiKey: "test-api-key-sites-delta",
          content: "Test content",
          domain: "delta-test.com",
          id: siteId,
          ownerId: user.id,
          summary: "Test summary",
        },
      });
    });

    describe("with two runs", () => {
      beforeAll(async () => {
        const run = await prisma.citationQueryRun.create({
          data: {
            siteId,
            platform: "chatgpt",
            model: "gpt-4o",
            onDate: new Date().toISOString().split("T")[0],
            queries: {
              create: {
                query: "test query",
                text: "response",
                group: "group",
                extraQueries: [],
              },
            },
          },
          include: { queries: true },
        });
        const queryId = run.queries[0].id;
        await prisma.citation.createMany({
          data: [
            {
              url: "https://delta-test.com/a",
              domain: "delta-test.com",
              relationship: "direct",
              queryId,
              runId: run.id,
              siteId,
            },
            {
              url: "https://delta-test.com/b",
              domain: "delta-test.com",
              relationship: "direct",
              queryId,
              runId: run.id,
              siteId,
            },
            {
              url: "https://delta-test.com/c",
              domain: "delta-test.com",
              relationship: "direct",
              queryId,
              runId: run.id,
              siteId,
            },
            {
              url: "https://delta-test.com/d",
              domain: "delta-test.com",
              relationship: "direct",
              queryId,
              runId: run.id,
              siteId,
            },
            {
              url: "https://delta-test.com/e",
              domain: "delta-test.com",
              relationship: "direct",
              queryId,
              runId: run.id,
              siteId,
            },
            {
              url: "https://delta-test.com/f",
              domain: "delta-test.com",
              relationship: "direct",
              queryId,
              runId: run.id,
              siteId,
            },
            {
              url: "https://delta-test.com/g",
              domain: "delta-test.com",
              relationship: "direct",
              queryId,
              runId: run.id,
              siteId,
            },
            {
              url: "https://delta-test.com/h",
              domain: "delta-test.com",
              relationship: "direct",
              queryId,
              runId: run.id,
              siteId,
            },
            {
              url: "https://delta-test.com/i",
              domain: "delta-test.com",
              relationship: "direct",
              queryId,
              runId: run.id,
              siteId,
            },
            {
              url: "https://delta-test.com/j",
              domain: "delta-test.com",
              relationship: "direct",
              queryId,
              runId: run.id,
              siteId,
            },
          ],
        });
        page = await ctx.newPage();
        await page.goto("/sites", { timeout: ms("10s") });
        await page.reload({ waitUntil: "load" });
        await page.waitForFunction(() => document.body.getAttribute("data-hydrated") === "true", {
          timeout: ms("15s"),
        });
      });

      it("should match visually", async () => {
        await expect(page.locator("main")).toMatchVisual({
          name: "sites/two-runs",
          modify: fixBaseline,
        });
      });
    });
  });
});

function fixBaseline(doc: Document) {
  for (const el of doc.querySelectorAll("*")) {
    if (el.tagName === "A" && /\/site\/[^/]+/.test(el.getAttribute("href") ?? ""))
      el.setAttribute("href", "/site/id");
    if (el.tagName === "INPUT" || el.tagName === "BUTTON") el.removeAttribute("id");
    if (el.getAttribute("class")?.includes("recharts-responsive-container")) el.remove();
  }
  return doc;
}
