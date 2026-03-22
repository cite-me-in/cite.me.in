import { expect } from "@playwright/test";
import { afterAll, beforeAll, describe, it } from "vitest";
import { removeElements } from "~/lib/html/parseHTML";
import prisma from "~/lib/prisma.server";
import type { User } from "~/prisma";
import { goto, port } from "../helpers/launchBrowser";
import { signIn } from "../helpers/signIn";

// ---------------------------------------------------------------------------
// Fixed seed data — deterministic so baselines never drift
// ---------------------------------------------------------------------------

// Use a fixed "today" so the date range doesn't shift between test runs.
// The default range is the last 30 days so visits within 30 days of this
// date will appear; visits older than 30 days will not.
const BASE_DATE = new Date("2026-02-26T00:00:00.000Z");

const BOT_VISITS = [
  {
    botType: "Google",
    userAgent: "Googlebot/2.1",
    path: "/",
    accept: ["text/html", "application/xhtml+xml"],
    count: 12,
    daysAgo: 0,
  },
  {
    botType: "Google",
    userAgent: "Googlebot/2.1",
    path: "/blog",
    accept: ["text/html"],
    count: 5,
    daysAgo: 3,
  },
  {
    botType: "ChatGPT",
    userAgent: "GPTBot/1.0",
    path: "/",
    accept: ["text/html", "text/plain"],
    count: 8,
    daysAgo: 1,
  },
  {
    botType: "Perplexity",
    userAgent: "PerplexityBot/1.0",
    path: "/about",
    accept: ["text/html"],
    count: 3,
    daysAgo: 2,
  },
] as const;

function daysAgo(n: number): Date {
  const d = new Date(BASE_DATE);
  d.setDate(d.getDate() - n);
  return d;
}

// ---------------------------------------------------------------------------

describe("unauthenticated access", () => {
  it("should redirect to /sign-in", async () => {
    const response = await fetch(`http://localhost:${port}/site/some-id/bots`, {
      redirect: "manual",
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/sign-in");
  });
});

describe("site bots page", () => {
  let user: User;
  let siteId: string;
  let siteDomain: string;

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        id: "user-bots-1",
        email: "site-bots-test@test.com",
        passwordHash: "test",
      },
    });
    const site = await prisma.site.create({
      data: {
        apiKey: "test-api-key-bots-1",
        content: "Test content",
        domain: "bots-test.example.com",
        id: "site-bots-1",
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
      page = await goto(`/site/${siteDomain}/bots`);
    });

    it("should show empty state message", async () => {
      await expect(page.getByText("No bot traffic recorded")).toBeVisible();
    });

    it("should show site domain breadcrumb", async () => {
      await expect(
        page.getByRole("link", { name: "bots-test.example.com" }),
      ).toBeVisible();
    });

    it("should match visually", { timeout: 30_000 }, async () => {
      await expect(page.locator("main")).toMatchVisual({
        name: "site.bots.empty",
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
      // Navigate with a fixed date range so the page content is deterministic
      page = await goto(
        `/site/${siteDomain}/bots?from=2026-01-27&until=2026-02-26`,
      );
    });

    it("should list all bot types in the activity table", async () => {
      await expect(
        page.getByRole("cell", { name: "Google", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("cell", { name: "ChatGPT", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("cell", { name: "Perplexity", exact: true }),
      ).toBeVisible();
    });

    it("should list crawled paths", async () => {
      await expect(
        page.getByRole("cell", { name: "/", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("cell", { name: "/blog", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("cell", { name: "/about", exact: true }),
      ).toBeVisible();
    });

    it("should show MIME types in Accept Types table", async () => {
      // Scope to the Accept Types table (column header "MIME Type") to avoid
      // matching the "text/html" cell in the Bot Activity accepts column.
      const mimeTable = page
        .locator("table")
        .filter({ has: page.locator("th", { hasText: "MIME Type" }) });
      await expect(
        mimeTable.getByRole("cell", { name: "text/html", exact: true }),
      ).toBeVisible();
    });

    it("should match visually", { timeout: 30_000 }, async () => {
      await expect(page.locator("main")).toMatchVisual({
        name: "site.bots.with-visits",
        modify: (html) =>
          removeElements(html, (node) => {
            if (node.attributes["data-slot"] === "chart") return true;
            const href = node.attributes.href ?? "";
            return href.startsWith("/site/") && !href.endsWith("/bots");
          }),
      });
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
      page = await goto(
        `/site/${siteDomain}/bots?from=2026-01-27&until=2026-02-26`,
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
