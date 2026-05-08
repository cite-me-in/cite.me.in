import { expect } from "@playwright/test";
import type { InputJsonObject } from "@prisma/client/runtime/client";
import { beforeAll, describe, it } from "vite-plus/test";
import sendAiLegibilityReport from "~/emails/AiLegibilityReport";
import { appendLog, startNewScan } from "~/lib/aiLegibility/progress.server";
import type { ScanResult } from "~/lib/aiLegibility/types";
import prisma from "~/lib/prisma.server";
import getLastEmailSent from "~/test/helpers/getLastEmailSent";
import { goto } from "~/test/helpers/launchBrowser";
import { port } from "~/test/helpers/launchServer";
import { signIn } from "~/test/helpers/signIn";
import "~/test/helpers/toMatchDownload";
import "~/test/helpers/toMatchVisual";

const SCAN_RESULT: ScanResult = {
  url: "https://example.com",
  scannedAt: "2026-04-19T10:00:00.000Z",
  checks: [
    {
      name: "Homepage Content",
      category: "trusted",
      passed: true,
      message: "Homepage has meaningful content (150+ characters)",
    },
    {
      name: "sitemap.txt",
      category: "discovered",
      passed: true,
      message: "sitemap.txt found with 10 valid URLs",
    },
    {
      name: "sitemap.xml",
      category: "discovered",
      passed: true,
      message: "sitemap.xml found with valid XML structure",
    },
    {
      name: "robots.txt",
      category: "welcomed",
      passed: true,
      message: "robots.txt found and references sitemap",
    },
    {
      name: "JSON-LD Structured Data",
      category: "trusted",
      passed: true,
      message: "Found 2 valid JSON-LD schemas: Organization, WebSite",
    },
    {
      name: "Meta Tags",
      category: "trusted",
      passed: true,
      message: "Found title, description, and Open Graph tags",
    },
    {
      name: "llms.txt",
      category: "discovered",
      passed: false,
      message: "llms.txt not found (optional but recommended)",
      detail: {
        goal: "Provide an llms.txt file for AI context",
        issue: "Without llms.txt, LLMs lack structured guidance",
        howToImplement: "Create /llms.txt at your site root",
        fixExample:
          "# Example Site\n> Description\n\n## Pages\n- [Home](https://example.com/)",
        effort: "15 min",
        resourceLinks: [
          { label: "llms.txt spec", url: "https://llmstxt.org/" },
        ],
      },
    },
  ],
  summary: {
    discovered: { passed: 2, total: 3 },
    trusted: { passed: 3, total: 3 },
    welcomed: { passed: 1, total: 1 },
  },
};

describe("unauthenticated access", () => {
  it("should redirect to /sign-in", async () => {
    const response = await fetch(
      `http://localhost:${port}/site/example.com/ai-legibility`,
      {
        redirect: "manual",
      },
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/sign-in");
  });
});

describe("ai-legibility page - no scan yet", () => {
  let page: import("playwright").Page;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        id: "ai-legibility-no-scan-user",
        email: "no-scan@test.com",
        passwordHash: "test",
      },
    });

    await prisma.site.create({
      data: {
        apiKey: "test-api-key-ai-legibility-1",
        content: "",
        domain: "no-scan-example.com",
        id: "site-no-scan",
        ownerId: user.id,
        summary: "",
      },
    });

    await signIn(user.id);
    page = await goto("/site/no-scan-example.com/ai-legibility");
  });

  it("should show the main heading", async () => {
    await expect(
      page.getByRole("heading", { name: "AI Legibility" }),
    ).toBeVisible();
  });

  it("should show check AI legibility title", async () => {
    await expect(page.getByText("Check AI Legibility")).toBeVisible();
  });

  it("should show run scan button", async () => {
    await expect(page.getByRole("button", { name: "Run Scan" })).toBeVisible();
  });

  it("should match visually - initial state", async () => {
    await expect(page.locator("main")).toMatchVisual({
      name: "ai-legibility/initial-state",
    });
  });
});

describe("ai-legibility page - with report", () => {
  let reportPage: import("playwright").Page;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        id: "ai-legibility-report-user",
        email: "report-test@example.com",
        passwordHash: "test",
      },
    });

    const site = await prisma.site.create({
      data: {
        apiKey: "test-api-key-ai-legibility-2",
        content: "",
        domain: "report-example.com",
        id: "site-report",
        ownerId: user.id,
        summary: "",
      },
    });

    await prisma.aiLegibilityReport.create({
      data: {
        id: "test-report-id",
        siteId: site.id,
        userId: user.id,
        result: SCAN_RESULT as InputJsonObject,
      },
    });

    await signIn(user.id);
    reportPage = await goto("/site/report-example.com/ai-legibility");
  });

  it("should show overall score", async () => {
    await expect(reportPage.getByText("AI Legibility Score")).toBeVisible();
  });

  it("should show score number", async () => {
    await expect(reportPage.getByText("86").first()).toBeVisible();
  });

  it("should show summary cards", async () => {
    await expect(reportPage.getByText("3/3").first()).toBeVisible();
    await expect(reportPage.getByText("2/3").first()).toBeVisible();
    await expect(reportPage.getByText("1/1").first()).toBeVisible();
  });

  it("should show critical checks passed", async () => {
    await expect(reportPage.getByText("3/3").first()).toBeVisible();
  });

  it("should show failed check in expanded accordion", async () => {
    await expect(reportPage.getByText("llms.txt").first()).toBeVisible();
  });

  it("should show run new scan button", async () => {
    await expect(
      reportPage.getByRole("button", { name: "Run New Scan" }),
    ).toBeVisible();
  });

  it("should match visually - results", async () => {
    // Wait for RadialGauge animation to reach final score
    await expect(reportPage.getByText("86").first()).toBeVisible();
    await expect(reportPage.locator("main")).toMatchVisual({
      name: "ai-legibility/results",
    });
  });

  it("should share score as a downloadable PNG", async () => {
    await expect(reportPage).toMatchDownload({
      name: "ai-legibility/share-image",
      trigger: reportPage.getByRole("button", { name: /share/i }).first(),
    });
  });
});

describe("ai-legibility page - scanning", () => {
  let scanningPage: import("playwright").Page;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        id: "ai-legibility-scanning-user",
        email: "scanning-test@example.com",
        passwordHash: "test",
      },
    });

    await prisma.site.create({
      data: {
        apiKey: "test-api-key-ai-legibility-4",
        content: "",
        domain: "scanning-example.com",
        id: "site-scanning",
        ownerId: user.id,
        summary: "",
      },
    });

    await startNewScan({ domain: "scanning-example.com" });
    await appendLog({
      domain: "scanning-example.com",
      line: "Checking homepage content...",
    });
    await appendLog({
      domain: "scanning-example.com",
      line: "✓ Homepage has meaningful content (150+ characters)",
    });
    await appendLog({
      domain: "scanning-example.com",
      line: "Checking sitemap.xml...",
    });
    await appendLog({
      domain: "scanning-example.com",
      line: "✓ sitemap.xml found with valid XML structure",
    });
    await appendLog({
      domain: "scanning-example.com",
      line: "Checking robots.txt...",
    });

    await signIn(user.id);
    scanningPage = await goto("/site/scanning-example.com/ai-legibility");
  });

  it("should show scanning indicator", async () => {
    await expect(scanningPage.getByText("Scanning…")).toBeVisible();
  });

  it("should show scan log", async () => {
    await expect(
      scanningPage.getByText("Checking homepage content..."),
    ).toBeVisible();
    await expect(
      scanningPage.getByText("✓ Homepage has meaningful content"),
    ).toBeVisible();
  });

  it("should match visually - scanning", async () => {
    await expect(scanningPage.locator("main")).toMatchVisual({
      name: "ai-legibility/scanning",
    });
  });
});

describe("ai-legibility page - accordion and flip card", () => {
  let page: import("playwright").Page;

  const CHECK_WITH_DETAIL: ScanResult = {
    url: "https://detail-example.com",
    scannedAt: "2026-04-19T10:00:00.000Z",
    checks: [
      {
        name: "llms.txt",
        category: "discovered",
        passed: true,
        message: "llms.txt found with valid content",
      },
      {
        name: "robots.txt",
        category: "discovered",
        passed: false,
        message: "robots.txt blocks AI crawlers",
        detail: {
          goal: "Allow AI crawlers to access your site",
          issue: "AI agents respect robots.txt directives",
          howToImplement: "Add Allow rules for known AI bot user-agents",
          fixExample:
            "User-agent: GPTBot\nAllow: /\nUser-agent: *\nDisallow: /private/",
          effort: "2 min",
          resourceLinks: [
            {
              label: "About robots.txt",
              url: "https://developers.google.com/search/docs/crawling-indexing/robots/intro",
            },
          ],
        },
      },
    ],
    summary: {
      discovered: { passed: 1, total: 2 },
      trusted: { passed: 0, total: 0 },
      welcomed: { passed: 0, total: 0 },
    },
  };

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        id: "ai-legibility-detail-user",
        email: "detail-test@example.com",
        passwordHash: "test",
      },
    });

    const site = await prisma.site.create({
      data: {
        apiKey: "test-api-key-ai-legibility-detail",
        content: "",
        domain: "detail-example.com",
        id: "site-detail",
        ownerId: user.id,
        summary: "",
      },
    });

    await prisma.aiLegibilityReport.create({
      data: {
        id: "test-report-detail-id",
        siteId: site.id,
        userId: user.id,
        result: CHECK_WITH_DETAIL as InputJsonObject,
      },
    });

    await signIn(user.id);
    page = await goto("/site/detail-example.com/ai-legibility");
  });

  it("should show accordion open for failed check", async () => {
    // The robots.txt check failed, so its accordion should be expanded
    await expect(
      page.getByText("Allow AI crawlers to access your site"),
    ).toBeVisible();
  });

  it("should show Goal section in expanded check", async () => {
    await expect(
      page.getByText("Allow AI crawlers to access your site"),
    ).toBeVisible();
  });

  it("should show Issue section in expanded check", async () => {
    await expect(page.getByText("robots.txt blocks AI crawlers")).toBeVisible();
  });

  it("should show How to implement section", async () => {
    await expect(
      page.getByText("Add Allow rules for known AI bot user-agents"),
    ).toBeVisible();
  });

  it("should show Example code block", async () => {
    await expect(page.getByText("User-agent: GPTBot")).toBeVisible();
  });

  it("should show Copy prompt button in expanded check", async () => {
    await expect(
      page.getByRole("button", { name: /copy prompt/i }),
    ).toBeVisible();
  });

  it("should match visually - accordion open on failed check", async () => {
    // Wait for RadialGauge animation to reach final score
    await expect(page.getByText("50").first()).toBeVisible();
    await expect(page.locator("main")).toMatchVisual({
      name: "ai-legibility/detail-accordion-open",
    });
  });
});

describe("ai-legibility page - improve score modal", () => {
  let page: import("playwright").Page;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        id: "ai-legibility-modal-user",
        email: "modal-test@example.com",
        passwordHash: "test",
      },
    });

    const site = await prisma.site.create({
      data: {
        apiKey: "test-api-key-ai-legibility-modal",
        content: "",
        domain: "modal-example.com",
        id: "site-modal",
        ownerId: user.id,
        summary: "",
      },
    });

    await prisma.aiLegibilityReport.create({
      data: {
        id: "test-report-modal-id",
        siteId: site.id,
        userId: user.id,
        result: {
          url: "https://modal-example.com",
          scannedAt: "2026-04-19T10:00:00.000Z",
          checks: [
            {
              name: "robots.txt",
              category: "discovered",
              passed: false,
              message: "robots.txt blocks AI crawlers",
              detail: {
                goal: "Allow AI crawlers to access your site",
                issue: "AI agents respect robots.txt directives",
                howToImplement: "Add Allow rules for known AI bot user-agents",
                effort: "2 min",
                resourceLinks: [],
              },
            },
          ],
          summary: {
            discovered: { passed: 0, total: 1 },
            trusted: { passed: 0, total: 0 },
            welcomed: { passed: 0, total: 0 },
          },
        },
      },
    });

    await signIn(user.id);
    page = await goto("/site/modal-example.com/ai-legibility");
  });

  it("should show Improve your score button", async () => {
    const button = page.getByRole("button", { name: /improve your score/i });
    await expect(button.first()).toBeVisible();
  });

  it("should open modal when clicked", async () => {
    await page
      .getByRole("button", { name: /improve your score/i })
      .first()
      .click();
    await expect(
      page.getByText("Improve your AI Legibility Score"),
    ).toBeVisible();
  });

  it("should show prompt textarea with content", async () => {
    const textarea = page.locator("textarea");
    await expect(textarea).toBeVisible();
    const text = await textarea.inputValue();
    expect(text.length).toBeGreaterThan(50);
    expect(text).toContain("Goal:");
  });

  it("should show Copy all instructions button", async () => {
    await expect(
      page.getByRole("button", { name: /copy all instructions/i }),
    ).toBeVisible();
  });

  it("should show issue count", async () => {
    await expect(page.getByText("1 issue to fix")).toBeVisible();
  });

  it("should close modal on Escape", async () => {
    await page.keyboard.press("Escape");
    await expect(
      page.getByText("Improve your AI Legibility Score"),
    ).not.toBeVisible();
  });

  it("should match visually - modal open", async () => {
    // Re-open modal for screenshot
    await page
      .getByRole("button", { name: /improve your score/i })
      .first()
      .click();
    await page.waitForTimeout(400);
    // Screenshot the full page to capture the backdrop + modal
    await expect(page).toMatchVisual({
      name: "ai-legibility/improve-score-modal",
    });
  });
});

describe("ai-legibility email", () => {
  let email: NonNullable<Awaited<ReturnType<typeof getLastEmailSent>>>;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        id: "ai-legibility-email-user",
        email: "email-test@example.com",
        passwordHash: "test",
        unsubscribed: false,
      },
    });

    const site = await prisma.site.create({
      data: {
        apiKey: "test-api-key-ai-legibility-3",
        content: "",
        domain: "email-example.com",
        id: "site-email",
        ownerId: user.id,
        summary: "",
      },
      include: { citations: true },
    });

    await sendAiLegibilityReport({
      site,
      result: SCAN_RESULT,
      sendTo: user,
    });

    email = await getLastEmailSent();
  });

  it("should send with correct subject", () => {
    expect(email.subject).toBe("AI Legibility Report for email-example.com");
  });

  it("should send to correct recipient", () => {
    expect(email.to).toBe("email-test@example.com");
  });

  it("should show score in email", async () => {
    await expect(email.page.getByText("86").first()).toBeVisible();
  });

  it("should show category summary", async () => {
    const page = email.page;
    await expect(
      page.getByText("Discovered", { exact: false }).first(),
    ).toBeVisible();
    await expect(
      page.getByText("Trusted", { exact: false }).first(),
    ).toBeVisible();
    await expect(
      page.getByText("Welcomed", { exact: false }).first(),
    ).toBeVisible();
  });

  it("should show code block for fix example", async () => {
    const codeBlock = email.page.locator("pre").first();
    await expect(codeBlock).toBeVisible();
    await expect(codeBlock).toContainText("# Example Site");
  });

  it("should show link to full report", async () => {
    await expect(
      email.page.getByRole("link", { name: /view full report/i }),
    ).toBeVisible();
  });

  it("should match visually", async () => {
    await email.page.setViewportSize({ width: 1024, height: 2400 });
    await expect(email.page).toMatchVisual({
      name: "email/ai-legibility-report",
    });
  });
});
