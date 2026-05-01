import { expect } from "@playwright/test";
import { beforeAll, describe, it } from "vite-plus/test";
import PLATFORMS from "~/lib/llm-visibility/platforms";
import prisma from "~/lib/prisma.server";
import type { User } from "~/prisma";
import { goto } from "~/test/helpers/launchBrowser";
import { port } from "~/test/helpers/launchServer";
import { signIn } from "~/test/helpers/signIn";

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

// Dates relative to today so the 30-day filter includes all runs.
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
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

    for (const { name, model } of PLATFORMS) {
      for (let runIdx = 0; runIdx < runDays.length; runIdx++) {
        const run = await prisma.citationQueryRun.create({
          data: {
            siteId: site.id,
            platform: name,
            model,
            onDate: daysAgo(runDays[runIdx]),
            queries: {
              createMany: {
                data: QUERIES.map(({ query, group }) => ({
                  query,
                  group,
                  text: `Response for "${query}".`,
                  extraQueries: [],
                })),
              },
            },
            ...(runIdx === 2 && {
              sentimentLabel:
                name === "chatgpt"
                  ? "positive"
                  : name === "gemini"
                    ? "negative"
                    : name === "claude"
                      ? "neutral"
                      : "mixed",
              sentimentSummary:
                name === "chatgpt"
                  ? "Rentail.space is cited positively across multiple queries, frequently appearing as a top recommendation for finding short-term retail space. It ranks prominently in citations and is described as a reliable marketplace for pop-up and kiosk leasing."
                  : name === "gemini"
                    ? "Rentail.space receives unfavorable mentions in several responses, with competitors ranked more prominently. Some responses question the platform's selection compared to established alternatives."
                    : name === "claude"
                      ? "Rentail.space is mentioned neutrally, appearing as one of several options without particular emphasis. Citations are factual with no positive or negative framing."
                      : "Rentail.space receives a mix of positive and critical mentions across queries. It ranks well for some use cases but is overlooked in others where competitors dominate.",
            }),
          },
          include: { queries: true },
        });

        // Create citations for each query
        const queryIds = run.queries.map((q) => q.id);
        for (let qi = 0; qi < queryIds.length; qi++) {
          const { citations } =
            CITATION_SETS[(qi * 3 + runIdx) % CITATION_SETS.length];
          await prisma.citation.createMany({
            data: citations.map((c) => ({
              url: c,
              domain: new URL(c).hostname,
              queryId: queryIds[qi],
              runId: run.id,
              siteId: site.id,
              relationship: new URL(c).hostname === HOSTNAME ? "direct" : null,
            })),
          });
        }
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

  it("should show negative sentiment for Gemini", async () => {
    await signIn(user.id);
    const page = await goto(`/site/${siteDomain}/citations?platform=gemini`);
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
      modify: (doc) => {
        for (const el of doc.querySelectorAll("*")) {
          if (el.getAttribute("data-slot") === "chart") {
            el.remove();
            continue;
          }
          const href = el.getAttribute("href") ?? "";
          if (href.startsWith("/site/")) el.remove();
        }
      },
    });
  });
});
