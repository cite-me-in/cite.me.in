import { expect } from "@playwright/test";
import { beforeAll, describe, it, vi } from "vitest";
import { getLastEmailSent } from "~/emails/sendEmails";
import { sendSiteDigestEmails } from "~/emails/WeeklyDigest";
import envVars from "~/lib/envVars";
import { newContext } from "../helpers/launchBrowser";
import chartBase64 from "./email.weekly-digest.png.base64?raw"

describe("WeeklyDigestEmail", () => {
  let email: NonNullable<Awaited<ReturnType<typeof getLastEmailSent>>>;

  beforeAll(async () => {
    // Pin Math.random so SentimentBreakdown's sample() always picks the same
    // platform and the visual baseline stays stable across runs.
    vi.spyOn(Math, "random").mockReturnValue(0);

    await sendSiteDigestEmails({
      subject: "Weekly Digest · Mar 17 — Mar 24, 2026",
      citationsURL: new URL(
        "/site/example.com/citations",
        envVars.VITE_APP_URL,
      ).toString(),
      toEmails: ["test@example.com"],
      citations: {
        total: { current: 142, previous: 137 },
        domain: { current: 23, previous: 18 },
      },
      score: { current: 72, previous: 64 },
      botVisits: { current: 1204, previous: 892 },
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
        perplexity: {
          count: 28,
          sentimentLabel: "negative",
          sentimentSummary:
            "Rentail.space receives unfavorable mentions in several responses, with competitors ranked more prominently.",
        },
      },
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
      chartBase64,
    });

    vi.restoreAllMocks();

    email = await getLastEmailSent();
  });

  it("should send with correct subject", () => {
    expect(email.subject).toBe("Weekly Digest · Mar 17 — Mar 24, 2026");
  });

  it("should send to correct recipient", () => {
    expect(email.to).toBe("test@example.com");
  });

  it("should match visually", async () => {
    const context = await newContext();
    const page = await context.newPage();
    await page.setContent(email.html, { waitUntil: "load" });
    await page.setViewportSize({ width: 1024, height: 2048 });

    // Hide the chart image before screenshotting — canvas rendering varies
    // slightly across environments and would cause false diff failures.
    await page
      .locator('img[alt="Citation trend: this week vs previous week"]')
      .evaluate((el) => {
        (el as HTMLElement).style.visibility = "hidden";
      });

    await expect(page).toMatchVisual({
      name: "email/weekly-digest",
    });
  });
});
