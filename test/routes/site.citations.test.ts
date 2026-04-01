import { expect } from "@playwright/test";
import { beforeAll, describe, it } from "vitest";
import { removeElements } from "~/lib/html/parseHTML";
import prisma from "~/lib/prisma.server";
import type { User } from "~/prisma";
import { goto, port } from "../helpers/launchBrowser";
import { signIn } from "../helpers/signIn";

// ---------------------------------------------------------------------------
// Fixed seed data — deterministic so HTML/screenshot baselines never drift
// ---------------------------------------------------------------------------

const HOSTNAME = "rentail.space";

const QUERIES = [
  {
    query: "How do I find short-term retail space in shopping malls?",
    group: "1. discovery",
  },
  {
    query:
      "What are the best platforms for finding pop-up shops in shopping centers?",
    group: "1. discovery",
  },
  {
    query: "Where can I lease a kiosk in a mall for 3-6 months?",
    group: "2. active_search",
  },
] as const;

// Nine fixed citation sets (3 queries × 3 repetitions).
// Position is the index of HOSTNAME in the citations array, or null if absent.
const CITATION_SETS: Array<{ citations: string[] }> = [
  {
    citations: [
      `https://${HOSTNAME}/marketplace`,
      "https://popupinsider.com/guide",
      "https://storeshq.com/retail",
    ],
  },
  {
    citations: [
      "https://popupinsider.com/guide",
      "https://siteselectiongroup.com/leasing",
      "https://storeshq.com/retail",
    ],
  },
  {
    citations: [
      "https://siteselectiongroup.com/leasing",
      `https://${HOSTNAME}/listings`,
      "https://storeshq.com/retail",
    ],
  },
  {
    citations: [
      `https://${HOSTNAME}/marketplace`,
      "https://popupinsider.com/guide",
    ],
  },
  {
    citations: [
      "https://storeshq.com/retail",
      "https://siteselectiongroup.com/leasing",
    ],
  },
  {
    citations: [
      "https://popupinsider.com/guide",
      "https://storeshq.com/retail",
      `https://${HOSTNAME}/faq`,
    ],
  },
  {
    citations: [
      `https://${HOSTNAME}/marketplace`,
      "https://popupinsider.com/guide",
      "https://storeshq.com/retail",
    ],
  },
  {
    citations: [
      "https://siteselectiongroup.com/leasing",
      "https://popupinsider.com/guide",
    ],
  },
  {
    citations: [
      `https://${HOSTNAME}/listings`,
      "https://storeshq.com/retail",
      "https://siteselectiongroup.com/leasing",
    ],
  },
];

const PLATFORMS = [
  { platform: "chatgpt", model: "gpt-5-chat-latest" },
  { platform: "perplexity", model: "sonar" },
  { platform: "claude", model: "claude-haiku-4-5-20251001" },
  { platform: "gemini", model: "gemini-2.5-flash" },
] as const;

// Fixed base date so createdAt values — and the date shown in the UI — never drift.
const BASE_DATE = new Date("2026-02-26T10:00:00.000Z");
function daysAgo(n: number): Date {
  const d = new Date(BASE_DATE);
  d.setDate(d.getDate() - n);
  return d;
}

// ---------------------------------------------------------------------------

describe("unauthenticated access", () => {
  it("should redirect to /sign-in", async () => {
    const response = await fetch(`http://localhost:${port}/site/some-id`, {
      redirect: "manual",
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/sign-in");
  });
});

describe("site page", () => {
  let user: User;
  let siteDomain: string;

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        id: "user-1",
        email: "site-page-test@test.com",
        passwordHash: "test",
      },
    });
    const site = await prisma.site.create({
      data: {
        apiKey: "test-api-key-citations-1",
        content: "Test content",
        domain: HOSTNAME,
        id: "site-1",
        ownerId: user.id,
        summary: "Test summary",
      },
    });
    siteDomain = site.domain;

    // Create SiteQuery records so the citations page can build mergedQueries.
    await prisma.siteQuery.createMany({
      data: QUERIES.map(({ query, group }) => ({
        siteId: site.id,
        query,
        group,
      })),
    });

    // Three runs per platform (oldest → newest) so charts have ≥2 data points.
    const runDays = [14, 7, 0];

    for (const { platform, model } of PLATFORMS) {
      for (let runIdx = 0; runIdx < runDays.length; runIdx++) {
        // Shift citation sets per run so visibility varies across history.
        const queryData = QUERIES.flatMap(({ query, group }, qi) => {
          const { citations } =
            CITATION_SETS[(qi * 3 + runIdx) % CITATION_SETS.length];
          return {
            query,
            group,
            text: `Response for "${query}".`,
            citations,
            extraQueries: [] as string[],
          };
        });

        await prisma.citationQueryRun.create({
          data: {
            siteId: site.id,
            platform,
            model,
            onDate: daysAgo(runDays[runIdx]).toISOString().split("T")[0],
            queries: { createMany: { data: queryData } },
            // Most recent runs have sentiment; each platform gets a different label
            // so we can test all sentiment states without extra sites.
            ...(runIdx === 2 && {
              sentimentLabel:
                platform === "chatgpt"
                  ? "positive"
                  : platform === "perplexity"
                    ? "negative"
                    : platform === "claude"
                      ? "neutral"
                      : "mixed",
              sentimentSummary:
                platform === "chatgpt"
                  ? "Rentail.space is cited positively across multiple queries, frequently appearing as a top recommendation for finding short-term retail space. It ranks prominently in citations and is described as a reliable marketplace for pop-up and kiosk leasing."
                  : platform === "perplexity"
                    ? "Rentail.space receives unfavorable mentions in several responses, with competitors ranked more prominently. Some responses question the platform's selection compared to established alternatives."
                    : platform === "claude"
                      ? "Rentail.space is mentioned neutrally, appearing as one of several options without particular emphasis. Citations are factual with no positive or negative framing."
                      : "Rentail.space receives a mix of positive and critical mentions across queries. It ranks well for some use cases but is overlooked in others where competitors dominate.",
            }),
          },
        });
      }
    }
  });

  it("should show positive sentiment for ChatGPT", async () => {
    await signIn(user.id);
    const page = await goto(`/site/${siteDomain}/citations?platform=chatgpt`);
    await expect(page.getByText("Positive", { exact: true })).toBeVisible();
    await expect(
      page.getByText(/Rentail\.space is cited positively/),
    ).toBeVisible();
  });

  it("should show negative sentiment for Perplexity", async () => {
    await signIn(user.id);
    const page = await goto(
      `/site/${siteDomain}/citations?platform=perplexity`,
    );
    await expect(page.getByText("Negative", { exact: true })).toBeVisible();
    await expect(page.getByText(/unfavorable mentions/)).toBeVisible();
  });

  it("should show neutral sentiment for Claude", async () => {
    await signIn(user.id);
    const page = await goto(`/site/${siteDomain}/citations?platform=claude`);
    await expect(page.getByText("Neutral", { exact: true })).toBeVisible();
    await expect(page.getByText(/mentioned neutrally/)).toBeVisible();
  });

  it("should match visually", async () => {
    await signIn(user.id);
    const page = await goto(`/site/${siteDomain}/citations`);
    // Strip chart SVGs: Recharts computes floating-point coordinates from
    // ResizeObserver measurements that drift slightly between runs. The
    // screenshot test covers visual regressions in charts.
    await expect(page.locator("main")).toMatchVisual({
      name: "site/citations",
      modify: (html) =>
        removeElements(html, (node) => {
          if (node.attributes["data-slot"] === "chart") return true;
          const href = node.attributes.href ?? "";
          return href.startsWith("/site/");
        }),
    });
  });
});
