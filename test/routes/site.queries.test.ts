import { expect } from "@playwright/test";
import { beforeAll, describe, it } from "vitest";
import { sessionCookie } from "~/lib/cookies.server";
import { removeElements } from "~/lib/html/parseHTML";
import prisma from "~/lib/prisma.server";
import type { User } from "~/prisma";
import { goto, port } from "../helpers/launchBrowser";
import { signIn } from "../helpers/signIn";

describe("unauthenticated access", () => {
  it("should redirect to /sign-in", async () => {
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
  let siteDomain: string;

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        id: "user-queries-1",
        email: "site-queries-test@test.com",
        passwordHash: "test",
      },
    });
    const site = await prisma.site.create({
      data: {
        apiKey: "test-api-key-queries-1",
        content: "Test content",
        domain: "queries-test.example.com",
        id: "site-queries-1",
        ownerId: user.id,
        summary: "Test summary",
      },
    });
    siteId = site.id;
    siteDomain = site.domain;
  });

  describe("empty state", () => {
    let page: Awaited<ReturnType<typeof goto>>;

    beforeAll(async () => {
      await signIn(user.id);
      page = await goto(`/site/${siteDomain}/queries`);
    });

    it("should show empty state message", async () => {
      await expect(page.getByText("No queries yet")).toBeVisible();
    });

    it("should show site domain breadcrumb", async () => {
      await expect(
        page.getByRole("link", { name: "queries-test.example.com" }),
      ).toBeVisible();
    });

    it("should show Add group button", async () => {
      await expect(
        page.getByRole("button", { name: "Add group" }),
      ).toBeVisible();
    });

    it("should match visually", async () => {
      await expect(page.locator("main")).toMatchVisual({
        name: "site/queries-empty",
        modify: (html) =>
          removeElements(html, (node) => {
            const href = node.attributes.href ?? "";
            return href.startsWith("/site/") && !href.endsWith("/queries");
          }),
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
      page = await goto(`/site/${siteDomain}/queries`);
    });

    it("should show group names", async () => {
      await expect(page.locator('input[value="1. discovery"]')).toBeVisible();
      await expect(
        page.locator('input[value="2. active_search"]'),
      ).toBeVisible();
    });

    it("should show query text", async () => {
      await expect(
        page.locator('input[value="How do I find short-term retail space?"]'),
      ).toBeVisible();
      await expect(
        page.locator('input[value="Where can I lease a kiosk in a mall?"]'),
      ).toBeVisible();
    });

    it("should show Add query button for each group", async () => {
      const addQueryButtons = page.getByRole("button", { name: "Add query" });
      await expect(addQueryButtons).toHaveCount(2);
    });

    it("should match visually", async () => {
      await expect(page.locator("main")).toMatchVisual({
        name: "site/queries-few",
        modify: (html) =>
          removeElements(html, (node) => {
            const href = node.attributes.href ?? "";
            return href.startsWith("/site/") && !href.endsWith("/queries");
          }),
      });
    });
  });

  describe("suggest action", () => {
    it("should complete gracefully when site has content", async () => {
      const siteWithContent = await prisma.site.create({
        data: {
          apiKey: "test-api-key-suggest-1",
          content: "Test content",
          domain: "suggest-test.example.com",
          id: "site-suggest-1",
          ownerId: user.id,
          summary: "Test summary",
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
        `http://localhost:${port}/site/${siteWithContent.domain}/queries`,
        { method: "POST", headers: { Cookie: cookieHeader }, body: form },
      );
      // Action succeeds or fails gracefully — page renders, no server crash
      expect(response.status).toBe(200);
      const body = await response.text();
      expect(body).toContain("Citation Queries");
    });
  });
});
