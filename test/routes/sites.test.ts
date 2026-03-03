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
    const user = await prisma.user.create({
      data: {
        id: "user-1",
        email: EMAIL,
        passwordHash: await hashPassword(PASSWORD),
        account: { create: { id: "account-1" } },
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
      const user = await prisma.user.findUniqueOrThrow({
        where: { email: EMAIL },
      });
      await prisma.site.create({
        data: {
          id: "site-1",
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

    it("shows a View link to the site", async () => {
      const link = page.getByRole("link", { name: "View Site" });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", /\/site\//);
    });

    it("shows Add Site button in list state", async () => {
      const page = await goto("/sites");
      await expect(page.getByRole("link", { name: "Add Site" })).toBeVisible();
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
