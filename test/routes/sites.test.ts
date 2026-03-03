import { expect } from "@playwright/test";
import { beforeAll, describe, it } from "vitest";
import { hashPassword } from "~/lib/auth.server";
import { removeElements } from "~/lib/html/parseHTML";
import prisma from "~/lib/prisma.server";
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
  beforeAll(async () => {
    await prisma.account.deleteMany();
    const user = await prisma.user.create({
      data: {
        id: "user-sites-test",
        email: EMAIL,
        passwordHash: await hashPassword(PASSWORD),
        account: { create: { id: "account-sites-test" } },
      },
    });
    await signIn(user.id);
  });

  describe("empty state", () => {
    let page: Awaited<ReturnType<typeof goto>>;

    beforeAll(async () => {
      page = await goto("/sites");
    });

    it("shows add site link", async () => {
      await expect(
        page.getByRole("link", { name: /add.*site/i }),
      ).toBeVisible();
    });

    it("HTML matches baseline", { timeout: 30_000 }, async () => {
      await expect(page.locator("main")).toMatchInnerHTML({
        name: "sites-empty",
      });
    });

    it("screenshot matches baseline", { timeout: 30_000 }, async () => {
      await expect(page.locator("main")).toMatchScreenshot({
        name: "sites-empty",
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
      page = await goto("/sites");
    });

    it("shows the site domain", async () => {
      await expect(
        page.getByText("example.com", { exact: true }),
      ).toBeVisible();
    });

    it("shows column headers", async () => {
      await expect(page.getByText("Domain", { exact: true })).toBeVisible();
      await expect(page.getByText("Citations", { exact: true })).toBeVisible();
      await expect(page.getByText("Avg Score", { exact: true })).toBeVisible();
      await expect(page.getByText("Bot Visits", { exact: true })).toBeVisible();
      await expect(page.getByText("Unique Bots", { exact: true })).toBeVisible();
    });

    it("shows View button", async () => {
      const link = page.getByRole("link", { name: "View" });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", /\/site\//);
    });

    it("shows Delete button", async () => {
      await expect(page.getByRole("button", { name: "Delete" })).toBeVisible();
    });

    it("shows Add Site button in list state", async () => {
      const addBtn = page.getByRole("link", { name: "Add Site" });
      await expect(addBtn).toBeVisible();
    });

    it("delete button opens confirmation dialog", async () => {
      const deleteBtn = page.getByRole("button", { name: "Delete" }).first();
      await deleteBtn.click();
      await expect(
        page.getByText("Are you sure you want to delete"),
      ).toBeVisible();
    });

    it("delete dialog requires domain name match", async () => {
      const deleteBtn = page.getByRole("button", { name: "Delete" }).first();
      await deleteBtn.click();
      const deleteConfirmBtn = page.getByRole("button", {
        name: "Delete Site",
      });
      // Initially disabled
      await expect(deleteConfirmBtn).toBeDisabled();
      // Type wrong domain
      await page.getByPlaceholder("example.com").fill("wrong.com");
      await expect(deleteConfirmBtn).toBeDisabled();
      // Type correct domain
      await page.getByPlaceholder("example.com").fill("example.com");
      await expect(deleteConfirmBtn).toBeEnabled();
    });

    it("HTML matches baseline", { timeout: 30_000 }, async () => {
      await expect(page.locator("main")).toMatchInnerHTML({
        name: "sites-list",
        strip: (html) =>
          removeElements(html, (node) => {
            if (node.tag !== "a") return false;
            const href = node.attributes.href ?? "";
            return href.startsWith("/site/") && href !== "/sites/new";
          }),
      });
    });

    it("screenshot matches baseline", { timeout: 30_000 }, async () => {
      await expect(page.locator("main")).toMatchScreenshot({
        name: "sites-list",
      });
    });
  });
});
