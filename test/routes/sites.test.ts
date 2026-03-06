import { type Page, expect } from "@playwright/test";
import { beforeAll, describe, it } from "vitest";
import { hashPassword } from "~/lib/auth.server";
import { removeElements } from "~/lib/html/parseHTML";
import prisma from "~/lib/prisma.server";
import type { Site, User } from "~/prisma";
import { goto, port } from "../helpers/launchBrowser";
import { signIn } from "../helpers/signIn";

const EMAIL = "sites-test@example.com";
const PASSWORD = "correct-password-123";

describe("unauthenticated access", () => {
  it("redirects to /sign-in", async () => {
    const response = await fetch(`http://localhost:${port}/sites`, {
      redirect: "manual",
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/sign-in");
  });
});

describe("sites route", () => {
  let page: Page;
  let user: User;

  beforeAll(async () => {
    await prisma.account.deleteMany();
    user = await prisma.user.create({
      data: {
        id: "user-sites-test",
        email: EMAIL,
        passwordHash: await hashPassword(PASSWORD),
        account: { create: { id: "account-sites-test" } },
      },
    });
    await signIn(user.id);
    page = await goto("/sites");
  });

  describe("empty state", () => {
    it("shows add site form", async () => {
      await expect(
        page.getByRole("button", { name: "Add Site" }),
      ).toBeVisible();
    });

    it("shows URL input and descriptive text", async () => {
      await expect(
        page.getByRole("textbox", { name: "Website URL or domain" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Add Site" }),
      ).toBeVisible();
      await expect(page.getByText("Enter a full URL")).toBeVisible();
    });

    it("HTML matches baseline", async () => {
      await expect(page.locator("main")).toMatchInnerHTML({
        name: "sites.empty",
      });
    });

    it("screenshot matches baseline", async () => {
      await expect(page.locator("main")).toMatchScreenshot({
        name: "sites.empty",
      });
    });

    it("shows error for invalid URL", async () => {
      await page
        .getByRole("textbox", { name: "Website URL or domain" })
        .fill("http://192.168.1.1");
      await page.getByRole("button", { name: "Add Site" }).click();
      await expect(
        page.getByText("Enter a valid website URL or domain name"),
      ).toBeVisible();
    });

    it("shows error for localhost", async () => {
      await page
        .getByRole("textbox", { name: "Website URL or domain" })
        .fill("localhost");
      await page.getByRole("button", { name: "Add Site" }).click();
      await expect(
        page.getByText("Enter a valid website URL or domain name"),
      ).toBeVisible();
    });

    describe("DNS failure", () => {
      it("shows DNS error for domain with no records", async () => {
        await page
          .getByRole("textbox", { name: "Website URL or domain" })
          .fill("this-domain-does-not-exist.invalid");
        await page.getByRole("button", { name: "Add Site" }).click();
        await expect(
          page.getByText("Enter a valid website URL or domain name"),
        ).toBeVisible();
      });
    });

    describe("duplicate domain", () => {
      it("shows error when domain already exists", async () => {
        const domain = "duplicate-test.com";
        await prisma.site.create({
          data: { id: "site-1", domain, accountId: user.accountId },
        });

        const token = crypto.randomUUID();
        await prisma.session.create({
          data: {
            token,
            userId: user.id,
            ipAddress: "127.0.0.1",
            userAgent: "test",
          },
        });

        await page
          .getByRole("textbox", { name: "Website URL or domain" })
          .fill("duplicate-test.com");
        await page.getByRole("button", { name: "Add Site" }).click();
        await expect(
          page.getByText("That domain is already added to your account"),
        ).toBeVisible();
      });
    });

    describe("successful save", () => {
      let site: Site;

      beforeAll(async () => {
        await page
          .getByRole("textbox", { name: "Website URL or domain" })
          .fill("example.com");
        await page.getByRole("button", { name: "Add Site" }).click();
        await page.waitForURL(/\/site\/[^/]+\/suggestions/);
        site = await prisma.site.findFirstOrThrow({
          where: { domain: "example.com", accountId: user.accountId },
        });
      });

      it("saves site and redirects to site page", async () => {
        expect(site).not.toBeNull();
      });

      it("navigates to suggestions page", async () => {
        expect(new URL(page.url()).pathname).toMatch(
          `/site/${site.id}/suggestions`,
        );
      });

      it("HTML matches baseline", async () => {
        await expect(page.locator("main")).toMatchInnerHTML({
          name: "sites.suggestions",
        });
      });

      it("screenshot matches baseline", async () => {
        await expect(page.locator("main")).toMatchScreenshot({
          name: "sites.suggestions",
        });
      });

      describe("skip button", () => {
        beforeAll(async () => {
          await page.getByRole("link", { name: "Skip" }).click();
          await page.waitForURL(/\/site\/[^/]+\/citations/);
        });

        it("navigates to citations page", async () => {
          expect(new URL(page.url()).pathname).toMatch(
            `/site/${site.id}/citations`,
          );
        });
      });

      describe("save queries button", () => {
        beforeAll(async () => {
          await page.goto(`/site/${site.id}/suggestions`);
          await page.getByRole("button", { name: "Save queries" }).click();
          await page.waitForURL(/\/site\/[^/]+\/citations/);
        });

        it("navigates to citations page", async () => {
          expect(new URL(page.url()).pathname).toMatch(
            `/site/${site.id}/citations`,
          );
        });

        it("HTML matches baseline", async () => {
          await expect(page.locator("main")).toMatchInnerHTML({
            name: "sites.citations",
          });
        });

        it("screenshot matches baseline", async () => {
          await expect(page.locator("main")).toMatchScreenshot({
            name: "sites.citations",
          });
        });
      });
    });
  });

  describe("with one site", () => {
    let page: Awaited<ReturnType<typeof goto>>;

    beforeAll(async () => {
      const user = await prisma.user.create({
        data: {
          id: "user-sites-test-2",
          email: "sites-test-2@example.com",
          passwordHash: await hashPassword(PASSWORD),
          account: { create: { id: "account-sites-test-2" } },
        },
      });
      await prisma.site.create({
        data: {
          id: "site-dashboard-test",
          domain: "example.com",
          accountId: user.accountId,
        },
      });
      await signIn(user.id);
      page = await goto("/sites");
    });

    it("shows the site domain", async () => {
      await expect(
        page.getByText("example.com", { exact: true }),
      ).toBeVisible();
    });

    it("shows column headers", async () => {
      await expect(page.getByText("Citations", { exact: true })).toBeVisible();
      await expect(page.getByText("Avg Score", { exact: true })).toBeVisible();
      await expect(page.getByText("Bot Visits", { exact: true })).toBeVisible();
      await expect(
        page.getByText("Unique Bots", { exact: true }),
      ).toBeVisible();
    });

    it("shows View button", async () => {
      const link = page.getByRole("link", { name: "example.com" });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", /\/site\//);
    });

    it("shows Delete button", async () => {
      await expect(
        page.getByRole("button", { name: "Delete site" }),
      ).toBeVisible();
    });

    it("HTML matches baseline", async () => {
      await expect(page.locator("main")).toMatchInnerHTML({
        name: "sites.list",
        strip: (html) =>
          removeElements(html, (node) => {
            if (node.tag !== "a") return false;
            const href = node.attributes.href ?? "";
            return href.startsWith("/site/") && href !== "/sites/new";
          }),
      });
    });

    it("screenshot matches baseline", async () => {
      await expect(page.locator("main")).toMatchScreenshot({
        name: "sites.list",
      });
    });

    describe("delete button", () => {
      beforeAll(async () => {
        const deleteBtn = page
          .getByRole("button", { name: "Delete site" })
          .first();
        await deleteBtn.click();
      });

      it("delete button opens confirmation dialog", async () => {
        await expect(
          page.getByText("Are you sure you want to delete"),
        ).toBeVisible();
      });

      it("delete dialog requires domain name match", async () => {
        const deleteConfirmBtn = page.getByRole("button", {
          name: "Delete Site",
        });
        // Initially disabled
        await expect(deleteConfirmBtn).toBeDisabled();

        // Type wrong domain
        await page.getByPlaceholder("example.com").fill("wrong.com");
        await expect(deleteConfirmBtn).toBeDisabled();
      });
    });
  });
});
