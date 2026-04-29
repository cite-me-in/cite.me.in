import { expect } from "@playwright/test";
import { beforeAll, describe, it } from "vite-plus/test";
import sendSiteSetupEmail from "~/emails/SiteSetupComplete";
import prisma from "~/lib/prisma.server";
import getLastEmailSent from "~/test/helpers/getLastEmailSent";

describe("SiteSetupComplete email", () => {
  let email: NonNullable<Awaited<ReturnType<typeof getLastEmailSent>>>;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: "test@example.com",
        passwordHash: "test",
        unsubscribed: false,
      },
    });
    await sendSiteSetupEmail({
      site: {
        domain: "example.com",
        citations: [],
      },
      sendTo: user,
      metrics: {
        totalCitations: 42,
        byPlatform: {
          chatgpt: {
            count: 15,
            sentimentLabel: "positive",
            sentimentSummary:
              "Example.com is cited positively, frequently recommended as the top result for relevant queries.",
          },
          claude: {
            count: 0,
            sentimentLabel: "neutral",
            sentimentSummary: "",
          },
          gemini: {
            count: 18,
            sentimentLabel: "mixed",
            sentimentSummary:
              "Example.com receives mixed mentions — positive in some contexts, absent in others.",
          },
          copilot: {
            count: 9,
            sentimentLabel: "negative",
            sentimentSummary:
              "Example.com rarely appears and when mentioned is ranked below competitors.",
          },
        },
        topQueries: [
          {
            query: "Best platforms for finding short-term retail space",
            count: 12,
          },
          { query: "Pop-up shop locations in shopping malls", count: 8 },
          { query: "How to lease a kiosk in a mall", count: 6 },
          { query: "Temporary retail space for sale", count: 4 },
          { query: "Short-term shop rental near me", count: 2 },
        ],
        competitors: [
          {
            domain: "popupinsider.com",
            brandName: "Popup Insider",
            url: "https://popupinsider.com",
            count: 22,
            pct: 31,
          },
          {
            domain: "storeshq.com",
            brandName: "Stores HQ",
            url: "https://storeshq.com",
            count: 14,
            pct: 20,
          },
          {
            domain: "siteselectiongroup.com",
            brandName: "Site Selection Group",
            url: "https://siteselectiongroup.com",
            count: 9,
            pct: 13,
          },
        ],
      },
    });
    email = await getLastEmailSent();
  });

  it("should send with correct subject", () => {
    expect(email.subject).toBe("Setup complete");
  });

  it("should send to correct recipient", () => {
    expect(email.to).toBe("test@example.com");
  });

  it("should match visually", async () => {
    await email.page.setViewportSize({ width: 1024, height: 2400 });
    await expect(email.page).toMatchVisual({
      name: "email/site-setup",
    });
  });
});
