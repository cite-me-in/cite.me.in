import type { User } from "~/prisma";
import { afterAll, beforeAll, describe, it } from "vitest";
import { removeElements } from "~/lib/html/parseHTML";
import { goto, port } from "../helpers/launchBrowser";
import { expect } from "@playwright/test";
import { signIn } from "../helpers/signIn";
import prisma from "~/lib/prisma.server";

const BASE_DATE = new Date("2026-02-26T00:00:00.000Z");

const HUMAN_VISITS = [
  {
    visitorId: "hv-visitor-1",
    browser: "Chrome",
    deviceType: "desktop",
    aiReferral: "chatgpt",
    count: 3,
    daysAgo: 0,
  },
  {
    visitorId: "hv-visitor-2",
    browser: "Firefox",
    deviceType: "mobile",
    aiReferral: "gemini",
    count: 1,
    daysAgo: 1,
  },
  {
    visitorId: "hv-visitor-3",
    browser: "Chrome",
    deviceType: "desktop",
    aiReferral: null,
    count: 5,
    daysAgo: 2,
  },
] as const;

function daysAgo(n: number): Date {
  const d = new Date(BASE_DATE);
  d.setDate(d.getDate() - n);
  return d;
}

describe("unauthenticated access", () => {
  it("should redirect to /sign-in", async () => {
    const response = await fetch(
      `http://localhost:${port}/site/some-id/visitors`,
      { redirect: "manual" },
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/sign-in");
  });
});

describe("site visitors page", () => {
  let user: User;
  let siteId: string;
  let siteDomain: string;

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        id: "user-visitors-1",
        email: "site-visitors-test@test.com",
        passwordHash: "test",
      },
    });
    const site = await prisma.site.create({
      data: {
        apiKey: "test-api-key-visitors-1",
        content: "Test content",
        domain: "visitors-test.example.com",
        id: "site-visitors-1",
        ownerId: user.id,
        summary: "Test summary",
      },
    });
    siteId = site.id;
    siteDomain = site.domain;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: user.id } });
  });

  describe("empty state", () => {
    let page: Awaited<ReturnType<typeof goto>>;

    beforeAll(async () => {
      await signIn(user.id);
      page = await goto(`/site/${siteDomain}/visitors`);
    });

    it("should show empty state message", async () => {
      await expect(page.getByText("No visitors recorded")).toBeVisible();
    });

    it("should show site domain breadcrumb", async () => {
      await expect(page.getByRole("link", { name: siteDomain })).toBeVisible();
    });

    it("should match visually", { timeout: 30_000 }, async () => {
      await expect(page.locator("main")).toMatchVisual({
        name: "site/visitors-empty",
      });
    });
  });

  describe("with human visits", () => {
    let page: Awaited<ReturnType<typeof goto>>;

    beforeAll(async () => {
      for (const v of HUMAN_VISITS) {
        const date = daysAgo(v.daysAgo);
        await prisma.humanVisit.create({
          data: {
            siteId,
            visitorId: v.visitorId,
            browser: v.browser,
            deviceType: v.deviceType,
            aiReferral: v.aiReferral ?? null,
            count: v.count,
            date,
            firstSeen: date,
            lastSeen: date,
          },
        });
      }
      page = await goto(
        `/site/${siteDomain}/visitors?from=2026-01-27&until=2026-02-26`,
      );
    });

    it("should show total unique visitors", async () => {
      // 3 visits = 3 unique visitors (one row per visitor per day)
      await expect(
        page
          .locator('[data-slot="card"]')
          .filter({ hasText: "Unique Visitors" })
          .getByText("3"),
      ).toBeVisible();
    });

    it("should show AI platforms in the breakdown table", async () => {
      await expect(
        page.getByRole("cell", { name: "chatgpt", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("cell", { name: "gemini", exact: true }),
      ).toBeVisible();
    });

    it("should match visually", { timeout: 30_000 }, async () => {
      await expect(page.locator("main")).toMatchVisual({
        name: "site/visitors-with-data",
        modify: (html) =>
          removeElements(html, (node) => {
            if (node.attributes["data-slot"] === "chart") return true;
            const href = node.attributes.href ?? "";
            return href.startsWith("/site/") && !href.endsWith("/visitors");
          }),
      });
    });
  });
});
