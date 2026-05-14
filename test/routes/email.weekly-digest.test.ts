import { expect } from "@playwright/test";
import { beforeAll, describe, it, vi } from "vite-plus/test";
import { sendSiteDigestEmails } from "~/emails/WeeklyDigest";
import envVars from "~/lib/envVars.server";
import prisma from "~/lib/prisma.server";
import getLastEmailSent from "~/test/helpers/getLastEmailSent";

vi.mock("~/emails/generateUnsubscribeToken", () => ({
  default: () => "test-token",
}));

describe("WeeklyDigestEmail", () => {
  let email: NonNullable<Awaited<ReturnType<typeof getLastEmailSent>>>;

  beforeAll(async () => {
    // Pin Math.random so SentimentBreakdown's sample() always picks the same
    // platform and the visual baseline stays stable across runs.
    vi.spyOn(Math, "random").mockReturnValue(0);

    const user = await prisma.user.create({
      data: {
        email: "test@example.com",
        passwordHash: "test",
        unsubscribed: false,
      },
    });

    await sendSiteDigestEmails({
      site: {
        id: "123",
        domain: "rentail.space",
        citations: [],
      },
      queryCoverageRate: { current: 68, previous: 52 },
      byPlatform: {
        chatgpt: {
          count: 45,
          sentimentLabel: "positive",
          sentimentSummary:
            "Rentail.space is cited positively across multiple queries, frequently appearing as a top recommendation for finding short-term retail space.",
        },
        claude: {
          count: 28,
          sentimentLabel: "neutral",
          sentimentSummary:
            "Rentail.space is mentioned neutrally, appearing as one of several options without particular emphasis.",
        },
        gemini: {
          count: 41,
          sentimentLabel: "mixed",
          sentimentSummary:
            "Rentail.space receives a mix of positive and critical mentions across queries.",
        },
        copilot: {
          count: 28,
          sentimentLabel: "negative",
          sentimentSummary:
            "Rentail.space receives unfavorable mentions in several responses, with competitors ranked more prominently.",
        },
      },
      citations: {
        total: { current: 142, previous: 137 },
        domain: { current: 23, previous: 18 },
      },
      citationsURL: new URL("/site/example.com/citations", envVars.VITE_APP_URL).toString(),
      citationTrends: {
        current: [10, 20, 30, 40, 50, 60, 70],
        previous: [5, 15, 25, 35, 45, 55, 65],
      },
      competitors: [
        {
          domain: "popupinsider.com",
          brandName: "Popup Insider",
          url: "https://popupinsider.com",
          count: 34,
          pct: 24,
        },
        {
          domain: "storeshq.com",
          brandName: "Stores HQ",
          url: "https://storeshq.com",
          count: 21,
          pct: 15,
        },
        {
          domain: "siteselectiongroup.com",
          brandName: "Site Selection Group",
          url: "https://siteselectiongroup.com",
          count: 15,
          pct: 11,
        },
      ],
      score: { current: 72, previous: 64 },
      sendTo: [user],
      topQueries: [
        {
          query: "How do I find short-term retail space in shopping malls?",
          count: 12,
          delta: 3,
        },
        {
          query: "Best platforms for pop-up shops in shopping centers?",
          count: 8,
          delta: -1,
        },
        {
          query: "Where can I lease a kiosk in a mall for 3-6 months?",
          count: 6,
          delta: 2,
        },
      ],
      visits: {
        pageViews: 100,
        uniqueVisitors: 50,
        aiReferredVisitors: 0.2,
        botVisits: 0.3,
      },
    });

    vi.restoreAllMocks();

    email = await getLastEmailSent();
  });

  it("should send with correct subject", () => {
    expect(email.subject).toBe("rentail.space • Nov 7 — Nov 14");
  });

  it("should send to correct recipient", () => {
    expect(email.to).toBe("test@example.com");
  });

  it("should match visually", async () => {
    await email.page.setViewportSize({ width: 1024, height: 3000 });
    await expect(email.page).toMatchVisual({
      name: "email/weekly-digest",
      modify: (doc) => {
        for (const el of doc.querySelectorAll("*")) {
          if (el.tagName === "IMG" && el.getAttribute("data-slot") === "chart") el.remove();
        }
      },
    });
  });
});
