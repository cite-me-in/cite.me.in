import { type Locator, type Page, expect } from "@playwright/test";
import { afterAll, beforeAll, describe, it } from "vitest";
import { hashPassword } from "~/lib/auth.server";
import type { HTMLNode } from "~/lib/html/HTMLNode";
import { modifyElements, removeElements } from "~/lib/html/parseHTML";
import prisma from "~/lib/prisma.server";
import type { Site, User } from "~/prisma";
import { goto } from "../helpers/launchBrowser";
import { signIn } from "../helpers/signIn";

describe("unauthenticated access", () => {
  it("redirects to /sign-in", async () => {
    const page = await goto("/sites");
    expect(page.url()).toContain("/sign-in");
  });
});

describe("sites route", () => {
  let page: Page;
  let user: User;

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        id: "user-sites-test",
        email: "sites-test@example.com",
        passwordHash: await hashPassword("correct-password-123"),
        account: { create: { id: "account-sites-test" } },
      },
    });
    await signIn(user.id);
    page = await goto("/sites");
  });

  describe("empty state", () => {
    it("should show URL input and descriptive text", async () => {
      await expect(
        page.getByRole("textbox", { name: "Website URL or domain" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Add Site" }),
      ).toBeVisible();
      await expect(page.getByText("Enter a full URL")).toBeVisible();
    });

    it("should show add site button", async () => {
      await expect(
        page.getByRole("button", { name: "Add Site" }),
      ).toBeVisible();
    });

    it("should match visually", async () => {
      await expect(page.locator("main")).toMatchVisual({
        name: "sites.empty",
        modify: fixBaseline,
      });
    });
  });

  describe("when user enters invalid URL", () => {
    beforeAll(async () => {
      page = await goto("/sites");
      await page
        .getByRole("textbox", { name: "Website URL or domain" })
        .fill("http://192.168.1.1");
      await page.getByRole("button", { name: "Add Site" }).click();
    });

    it("should show error for invalid URL", async () => {
      await expect(
        page.getByText("Enter a valid website URL or domain name"),
      ).toBeVisible();
    });
  });

  describe("when user enters localhost URL", () => {
    beforeAll(async () => {
      page = await goto("/sites");
      await page
        .getByRole("textbox", { name: "Website URL or domain" })
        .fill("localhost");
      await page.getByRole("button", { name: "Add Site" }).click();
    });

    it("should show error for localhost", async () => {
      await expect(
        page.getByText("Enter a valid website URL or domain name"),
      ).toBeVisible();
    });
  });

  describe("when DNS failure", () => {
    beforeAll(async () => {
      page = await goto("/sites");
      await page
        .getByRole("textbox", { name: "Website URL or domain" })
        .fill("this-domain-does-not-exist.invalid");
      await page.getByRole("button", { name: "Add Site" }).click();
    });

    it("should show DNS error for domain with no records", async () => {
      await expect(
        page.getByText(
          "No DNS records found for this-domain-does-not-exist.invalid. Is the domain live?",
        ),
      ).toBeVisible();
    });
  });

  describe("when duplicate domain", () => {
    let page: Page;

    beforeAll(async () => {
      await prisma.site.create({
        data: {
          id: "site-1",
          domain: "duplicate-test.com",
          accountId: user.accountId,
        },
      });
      page = await goto("/sites");
      await page.getByRole("button", { name: "Add Site" }).click();
      await page
        .getByRole("textbox", { name: "Website URL or domain" })
        .fill("duplicate-test.com");
      await page.getByRole("button", { name: "Add Site" }).click();
    });

    it("should redirect to site page", async () => {
      await expect(page).toHaveURL("/site/site-1/suggestions");
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

      page = await goto("/sites");
      await page
        .getByRole("textbox", { name: "Website URL or domain" })
        .fill("example.com");
      await page.getByRole("button", { name: "Add Site" }).click();
      await page.waitForURL(/\/site\/[^/]+\/suggestions/);
      // Wait for suggestions to finish loading
      await page.waitForSelector('button:text("Save queries")', {
        timeout: 30000,
      });

      site = await prisma.site.findFirstOrThrow({
        where: { domain: "example.com", accountId: user.accountId },
      });
    });

    it("should save site and redirect to suggestions page", async () => {
      expect(site).not.toBeNull();
    });

    it("should navigate to suggestions page", async () => {
      expect(new URL(page.url()).pathname).toMatch(
        `/site/${site.id}/suggestions`,
      );
    });

    it("should match visually", async () => {
      await expect(page.locator("main")).toMatchVisual({
        name: "sites.suggestions",
        modify: fixBaseline,
      });
    });

    it("should have skip link to citations page", async () => {
      const link = page.getByRole("link", { name: "Skip" });
      const href = await link.getAttribute("href");
      expect(href).toContain(`/site/${site.id}`);
    });

    describe("when save queries button", () => {
      beforeAll(async () => {
        expect(page.url()).toMatch(/\/site\/[^/]+\/suggestions/);
        await page.getByRole("button", { name: "Save queries" }).click();
        await page.waitForURL(/\/site\/[^/]+\/citations/);

        await page
          .locator('text="Most Recent Run"')
          .waitFor({ state: "visible" });
      });

      it("should navigate to citations page", async () => {
        expect(new URL(page.url()).pathname).toMatch(
          `/site/${site.id}/citations`,
        );
      });

      it("should match visually", async () => {
        await expect(page.locator("main")).toMatchVisual({
          name: "sites.citations",
          modify: fixBaseline,
        });
      });
    });
  });

  describe("when site available", () => {
    beforeAll(async () => {
      await prisma.site.create({
        data: {
          id: "site-dashboard-test",
          domain: "dashboard-test.com",
          accountId: user.accountId,
        },
      });
      page = await goto("/sites");
    });

    it("should show column headers", async () => {
      const container = page.locator('a:has-text("Citations")').last();
      await expect(
        container.getByText("Citations", { exact: true }),
      ).toBeVisible();
      await expect(
        container.getByText("Avg Score", { exact: true }),
      ).toBeVisible();
      await expect(
        container.getByText("Bot Visits", { exact: true }),
      ).toBeVisible();
      await expect(
        container.getByText("Unique Bots", { exact: true }),
      ).toBeVisible();
    });

    it("should match visually", async () => {
      await expect(page.locator("main")).toMatchVisual({
        name: "sites.list",
        modify: fixBaseline,
      });
    });

    describe("when delete button", () => {
      let deleteConfirmBtn: Locator;
      let confirmDomainInput: Locator;
      let count: number;

      beforeAll(async () => {
        count = await prisma.site.count();
        const deleteBtn = page
          .getByRole("button", { name: "Delete site" })
          .first();
        await deleteBtn.click();

        deleteConfirmBtn = page.getByRole("button", {
          name: "Delete Site",
        });
        confirmDomainInput = page.getByPlaceholder("dashboard-test.com");
      });

      it("should open confirmation dialog", async () => {
        await expect(
          page.getByText("Are you sure you want to delete"),
        ).toBeVisible();
      });

      it("should require domain name match", async () => {
        // Initially disabled
        await expect(deleteConfirmBtn).toBeDisabled();
        // Type wrong domain
        await confirmDomainInput.fill("wrong.com");
        await expect(deleteConfirmBtn).toBeDisabled();
      });

      it("should match visually", async () => {
        await expect(page.locator("main")).toMatchVisual({
          name: "sites.delete",
          modify: fixBaseline,
        });
      });

      describe("when domain matches", () => {
        beforeAll(async () => {
          await confirmDomainInput.fill("dashboard-test.com");
          await expect(deleteConfirmBtn).toBeEnabled();
          await page.getByRole("button", { name: "Delete Site" }).click();
          await expect(page.getByRole("dialog")).toBeHidden();
        });

        it("should delete site", async () => {
          const updated = await prisma.site.count({
            where: { accountId: user.accountId },
          });
          expect(updated).toBe(count - 1);
        });
      });
    });

    afterAll(async () => {
      await prisma.site.deleteMany();
    });
  });
});

function fixBaseline(html: HTMLNode[]) {
  // Ignore the varying href attribute on site links
  modifyElements(
    html,
    (node) =>
      node.tag === "a" && /\/site\/[^/]+/.test(node.attributes.href ?? ""),
    (node) => ({
      ...node,
      attributes: { ...node.attributes, href: "/site/id" },
    }),
  );

  // Ignore the varying style attribute on input elements
  modifyElements(
    html,
    (node) => node.tag === "input",
    (node) => ({
      ...node,
      attributes: { ...node.attributes, id: "_r_0_", style: null },
    }),
  );

  // Don't test Recharts charts
  removeElements(
    html,
    (node) =>
      !!node.attributes.class?.includes("recharts-responsive-container"),
  );

  return html;
}
