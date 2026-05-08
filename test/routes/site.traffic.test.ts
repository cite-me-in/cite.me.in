import { expect } from "@playwright/test";
import { afterAll, beforeAll, describe, it } from "vite-plus/test";
import prisma from "~/lib/prisma.server";
import type { User } from "~/prisma";
import { goto } from "~/test/helpers/launchBrowser";
import { port } from "~/test/helpers/launchServer";
import { signIn } from "~/test/helpers/signIn";

const BASE_DATE = new Date("2026-02-26T00:00:00.000Z");

const BOT_VISITS = [
  {
    botClass: "search_indexing",
    botType: "Google",
    userAgent: "Googlebot/2.1",
    path: "/",
    accept: ["text/html", "application/xhtml+xml"],
    count: 12,
    daysAgo: 0,
  },
  {
    botClass: "search_indexing",
    botType: "Google",
    userAgent: "Googlebot/2.1",
    path: "/blog",
    accept: ["text/html"],
    count: 5,
    daysAgo: 3,
  },
  {
    botClass: "training",
    botType: "GPT Bot",
    userAgent: "GPTBot/1.0",
    path: "/",
    accept: ["text/html", "text/plain"],
    count: 8,
    daysAgo: 1,
  },
  {
    botClass: "other",
    botType: "Gemini",
    userAgent: "GeminiBot/1.0",
    path: "/about",
    accept: ["text/html"],
    count: 3,
    daysAgo: 2,
  },
] as const;

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
      `http://localhost:${port}/site/some-id/traffic`,
      {
        redirect: "manual",
      },
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/sign-in");
  });
});

describe("traffic page", () => {
  let user: User;
  let siteId: string;
  let siteDomain: string;

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        id: "user-traffic-1",
        email: "traffic-test@test.com",
        passwordHash: "test",
      },
    });
    const site = await prisma.site.create({
      data: {
        apiKey: "test-api-key-traffic-1",
        content: "Test content",
        domain: "traffic-test.example.com",
        id: "site-traffic-1",
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
      const ctx = await signIn(user.id);
      page = await goto(`/site/${siteDomain}/traffic`, ctx);
    });

    it("should show no visitors message", async () => {
      await expect(page.getByText("No visitors recorded")).toBeVisible();
    });

    it("should show site domain breadcrumb", async () => {
      await expect(page.getByRole("link", { name: siteDomain })).toBeVisible();
    });

    it("should match visually", { timeout: 15_000 }, async () => {
      await expect(page.locator("main")).toMatchVisual({
        name: "site/traffic-empty",
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
      const ctx = await signIn(user.id);
      page = await goto(
        `/site/${siteDomain}/traffic?from=2026-01-27&until=2026-02-26`,
        ctx,
      );
    });

    afterAll(async () => {
      await prisma.humanVisit.deleteMany({ where: { siteId } });
    });

    it("should show total unique visitors", async () => {
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

    it("should match visually", { timeout: 15_000 }, async () => {
      await expect(page.locator("main")).toMatchVisual({
        name: "site/traffic-with-visitors",
        modify: (doc) => {
          for (const el of doc.querySelectorAll("*")) {
            if (el.getAttribute("data-slot") === "chart") {
              el.remove();
              continue;
            }
            const href = el.getAttribute("href") ?? "";
            if (href.startsWith("/site/") && !href.endsWith("/traffic"))
              el.remove();
          }
        },
      });
    });
  });

  describe("with bot visits", () => {
    let page: Awaited<ReturnType<typeof goto>>;

    beforeAll(async () => {
      for (const v of BOT_VISITS) {
        await prisma.botVisit.create({
          data: {
            siteId,
            botClass: v.botClass,
            botType: v.botType,
            userAgent: v.userAgent,
            path: v.path,
            accept: [...v.accept],
            count: v.count,
            date: daysAgo(v.daysAgo),
            firstSeen: daysAgo(v.daysAgo),
            lastSeen: daysAgo(v.daysAgo),
          },
        });
      }
      const ctx = await signIn(user.id);
      page = await goto(
        `/site/${siteDomain}/traffic?from=2026-01-27&until=2026-02-26`,
        ctx,
      );
    });

    afterAll(async () => {
      await prisma.botVisit.deleteMany({ where: { siteId } });
    });

    it("should list all bot types in the activity table", async () => {
      await expect(
        page.getByRole("cell", { name: "Google", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("cell", { name: "GPT Bot", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("cell", { name: "Gemini", exact: true }),
      ).toBeVisible();
    });

    it("should show bot traffic trend chart", async () => {
      await expect(page.getByText("Traffic Trend")).toBeVisible();
    });
  });

  describe("with bot insight", () => {
    let page: Awaited<ReturnType<typeof goto>>;

    beforeAll(async () => {
      await prisma.botInsight.create({
        data: {
          siteId,
          content: "ChatGPT visited 8 times this week, mostly your homepage.",
          generatedAt: new Date("2026-02-26T12:00:00Z"),
        },
      });
      const ctx = await signIn(user.id);
      page = await goto(
        `/site/${siteDomain}/traffic?from=2026-01-27&until=2026-02-26`,
        ctx,
      );
    });

    afterAll(async () => {
      await prisma.botInsight.deleteMany({ where: { siteId } });
    });

    it("should show the insight text", async () => {
      await expect(
        page.getByText(
          "ChatGPT visited 8 times this week, mostly your homepage.",
        ),
      ).toBeVisible();
    });

    it("should show the Updated label", async () => {
      await expect(page.getByText(/Updated/)).toBeVisible();
    });
  });
});
