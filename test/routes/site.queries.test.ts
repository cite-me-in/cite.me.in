import { expect } from "@playwright/test";
import { beforeAll, describe, it } from "vitest";
import { sessionCookie } from "~/lib/cookies.server";
import { removeElements } from "~/lib/html/parseHTML";
import prisma from "~/lib/prisma.server";
import type { User } from "~/prisma";
import { goto, port } from "../helpers/launchBrowser";
import { signIn } from "../helpers/signIn";

describe("unauthenticated access", () => {
  it("redirects to /sign-in", async () => {
    const response = await fetch(
      `http://localhost:${port}/site/some-id/queries`,
      { redirect: "manual" },
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/sign-in");
  });
});

describe("site queries page", () => {
  let user: User;
  let siteId: string;

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        id: "user-queries-1",
        account: { create: { id: "account-queries-1" } },
        email: "site-queries-test@test.com",
        passwordHash: "test",
      },
    });
    const site = await prisma.site.create({
      data: {
        id: "site-queries-1",
        domain: "queries-test.example.com",
        accountId: user.accountId,
      },
    });
    siteId = site.id;
  });

  describe("empty state", () => {
    let page: Awaited<ReturnType<typeof goto>>;

    beforeAll(async () => {
      await signIn(user.id);
      page = await goto(`/site/${siteId}/queries`);
    });

    it("shows empty state message", async () => {
      await expect(page.getByText("No queries yet")).toBeVisible();
    });

    it("shows site domain breadcrumb", async () => {
      await expect(
        page.getByRole("link", { name: "queries-test.example.com" }),
      ).toBeVisible();
    });

    it("shows Add group button", async () => {
      await expect(
        page.getByRole("button", { name: "Add group" }),
      ).toBeVisible();
    });

    it("HTML matches baseline", { timeout: 30_000 }, async () => {
      await expect(page.locator("main")).toMatchInnerHTML({
        name: "site-queries-empty",
        strip: (html) =>
          removeElements(html, (node) => {
            const href = node.attributes.href ?? "";
            return href.startsWith("/site/") && !href.endsWith("/queries");
          }),
      });
    });

    it("screenshot matches baseline", { timeout: 30_000 }, async () => {
      await expect(page.locator("main")).toMatchScreenshot({
        name: "site-queries-empty",
      });
    });
  });

  describe("with queries", () => {
    let page: Awaited<ReturnType<typeof goto>>;

    beforeAll(async () => {
      await prisma.siteQuery.createMany({
        data: [
          {
            siteId,
            group: "1. discovery",
            query: "How do I find short-term retail space?",
          },
          {
            siteId,
            group: "2. active_search",
            query: "What are the best platforms for pop-up shops?",
          },
          {
            siteId,
            group: "2. active_search",
            query: "Where can I lease a kiosk in a mall?",
          },
        ],
      });
      page = await goto(`/site/${siteId}/queries`);
    });

    it("shows group names", async () => {
      await expect(page.locator('input[value="1. discovery"]')).toBeVisible();
      await expect(
        page.locator('input[value="2. active_search"]'),
      ).toBeVisible();
    });

    it("shows query text", async () => {
      await expect(
        page.locator('input[value="How do I find short-term retail space?"]'),
      ).toBeVisible();
      await expect(
        page.locator('input[value="Where can I lease a kiosk in a mall?"]'),
      ).toBeVisible();
    });

    it("shows Add query button for each group", async () => {
      const addQueryButtons = page.getByRole("button", { name: "Add query" });
      await expect(addQueryButtons).toHaveCount(2);
    });

    it("HTML matches baseline", { timeout: 30_000 }, async () => {
      await expect(page.locator("main")).toMatchInnerHTML({
        name: "site-queries",
        strip: (html) =>
          removeElements(html, (node) => {
            const href = node.attributes.href ?? "";
            return href.startsWith("/site/") && !href.endsWith("/queries");
          }),
      });
    });

    it("screenshot matches baseline", { timeout: 30_000 }, async () => {
      await expect(page.locator("main")).toMatchScreenshot({
        name: "site-queries",
      });
    });
  });

  describe("suggest action", () => {
    it("returns error when site has no content", async () => {
      const token = crypto.randomUUID();
      await prisma.session.create({
        data: {
          token,
          userId: user.id,
          ipAddress: "127.0.0.1",
          userAgent: "test",
        },
      });
      const cookieHeader = await sessionCookie.serialize(token);

      const form = new FormData();
      form.append("_intent", "suggest");

      const response = await fetch(
        `http://localhost:${port}/site/${siteId}/queries`,
        { method: "POST", headers: { Cookie: cookieHeader }, body: form },
      );
      expect(response.status).toBe(200);
      const body = await response.text();
      expect(body).toContain("No site content available");
    });

    it("completes gracefully when site has content", async () => {
      const siteWithContent = await prisma.site.create({
        data: {
          id: "site-suggest-1",
          domain: "suggest-test.example.com",
          accountId: user.accountId,
          content: "Rentail helps brands find short-term retail space.",
        },
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
      const cookieHeader = await sessionCookie.serialize(token);

      const form = new FormData();
      form.append("_intent", "suggest");

      const response = await fetch(
        `http://localhost:${port}/site/${siteWithContent.id}/queries`,
        { method: "POST", headers: { Cookie: cookieHeader }, body: form },
      );
      // Action succeeds or fails gracefully — page renders, no server crash
      expect(response.status).toBe(200);
      const body = await response.text();
      expect(body).toContain("Citation Queries");
    });
  });
});
