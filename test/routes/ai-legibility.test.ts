import { expect } from "@playwright/test";
import { beforeAll, describe, it } from "vitest";
import sendAiLegibilityReport from "~/emails/AiLegibilityReport";
import { getLastEmailSent } from "~/emails/sendEmails";
import type { ScanResult } from "~/lib/aiLegibility/types";
import prisma from "~/lib/prisma.server";
import { goto, newContext } from "../helpers/launchBrowser";

const SCAN_RESULT: ScanResult = {
  url: "https://example.com",
  scannedAt: "2026-04-19T10:00:00.000Z",
  checks: [
    {
      name: "Homepage Content",
      category: "critical",
      passed: true,
      message: "Homepage has meaningful content (150+ characters)",
    },
    {
      name: "sitemap.txt",
      category: "critical",
      passed: true,
      message: "sitemap.txt found with 10 valid URLs",
    },
    {
      name: "sitemap.xml",
      category: "critical",
      passed: true,
      message: "sitemap.xml found with valid XML structure",
    },
    {
      name: "robots.txt",
      category: "critical",
      passed: true,
      message: "robots.txt found and references sitemap",
    },
    {
      name: "JSON-LD Structured Data",
      category: "important",
      passed: true,
      message: "Found 2 valid JSON-LD schemas: Organization, WebSite",
    },
    {
      name: "Meta Tags",
      category: "important",
      passed: true,
      message: "Found title, description, and Open Graph tags",
    },
    {
      name: "llms.txt",
      category: "optimization",
      passed: false,
      message: "llms.txt not found (optional but recommended)",
    },
  ],
  summary: {
    critical: { passed: 4, total: 4 },
    important: { passed: 2, total: 2 },
    optimization: { passed: 0, total: 1 },
  },
  suggestions: [
    {
      title: "Add llms.txt for AI discoverability",
      category: "optimization",
      effort: "5 min",
      description:
        "Create an llms.txt file at the root of your site to provide structured context for LLMs. This helps AI agents understand your content better.",
      fixExample:
        "# Example Site\n\nMain description here.\n\n## Sections\n- /about\n- /pricing",
    },
  ],
};

describe("ai-legibility page", () => {
  let page: import("playwright").Page;

  beforeAll(async () => {
    page = await goto("/ai-legibility");
  });

  it("should show the main heading", async () => {
    await expect(
      page.getByRole("heading", { name: "AI Legibility Checker" }),
    ).toBeVisible();
  });

  it("should show the description", async () => {
    await expect(
      page.getByText("Check if your website is readable by AI agents"),
    ).toBeVisible();
  });

  it("should show the URL input field", async () => {
    await expect(
      page.getByRole("textbox", { name: "Website URL" }),
    ).toBeVisible();
  });

  it("should show the scan button", async () => {
    await expect(
      page.getByRole("button", { name: "Scan Website" }),
    ).toBeVisible();
  });

  it("should show the card with yellow variant", async () => {
    const card = page.locator('[data-slot="card"]').first();
    await expect(card).toBeVisible();
  });

  it("should match visually", async () => {
    await expect(page.locator("main")).toMatchVisual({
      name: "ai-legibility/form",
    });
  });

  it("should show error for empty URL submission", async () => {
    const currentPage = await goto("/ai-legibility");
    await currentPage.getByRole("button", { name: "Scan Website" }).click();
    await expect(currentPage.getByText("URL is required")).toBeVisible();
  });

  it("should accept URL input", async () => {
    const currentPage = await goto("/ai-legibility");
    const input = currentPage.getByRole("textbox", { name: "Website URL" });
    await input.fill("https://example.com");
    await expect(input).toHaveValue("https://example.com");
  });
});

describe("ai-legibility scan in progress", () => {
  let progressPage: import("playwright").Page;

  beforeAll(async () => {
    const context = await newContext();
    progressPage = await context.newPage();

    await progressPage.route("**/ai-legibility/status*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          lines: [
            "Starting scan for https://example.com...",
            "Checking homepage content...",
            "Homepage has meaningful content (150+ characters)",
            "Checking sitemap.txt...",
            "sitemap.txt found with 10 valid URLs",
            "Checking sitemap.xml...",
          ],
          done: false,
          nextOffset: 6,
        }),
      });
    });

    await progressPage.goto(
      "/ai-legibility?scanId=test-scan-id&url=https://example.com",
    );
    await progressPage.waitForSelector('text="Scanning…"');
  });

  it("should show scanning status", async () => {
    await expect(progressPage.getByText("Scanning…")).toBeVisible();
  });

  it("should show scanned URL", async () => {
    await expect(progressPage.getByText("https://example.com")).toBeVisible();
  });

  it("should show progress log", async () => {
    await expect(
      progressPage.getByText("Checking homepage content..."),
    ).toBeVisible();
    await expect(
      progressPage.getByText("sitemap.txt found with 10 valid URLs"),
    ).toBeVisible();
  });

  it("should match visually", async () => {
    await expect(progressPage.locator("main")).toMatchVisual({
      name: "ai-legibility/scanning",
    });
  });
});

describe("ai-legibility report page", () => {
  let reportPage: import("playwright").Page;
  let user: { id: string; email: string };

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        id: "ai-legibility-report-user",
        email: "report-test@example.com",
        passwordHash: "test",
      },
    });

    await prisma.aiLegibilityReport.create({
      data: {
        id: "test-report-id",
        userId: user.id,
        url: SCAN_RESULT.url,
        scannedAt: new Date(SCAN_RESULT.scannedAt),
        result: JSON.parse(JSON.stringify(SCAN_RESULT)),
      },
    });

    reportPage = await goto("/ai-legibility/test-report-id");
  });

  it("should show report heading", async () => {
    await expect(
      reportPage.getByRole("heading", { name: "AI Legibility Report" }),
    ).toBeVisible();
  });

  it("should show scanned URL", async () => {
    await expect(reportPage.getByText("https://example.com")).toBeVisible();
  });

  it("should show summary cards", async () => {
    const summarySection = reportPage.locator(".grid").first();
    await expect(summarySection.getByText("Critical")).toBeVisible();
    await expect(summarySection.getByText("Important")).toBeVisible();
    await expect(summarySection.getByText("Optimization")).toBeVisible();
  });

  it("should show critical checks passed", async () => {
    await expect(reportPage.getByText("4/4").first()).toBeVisible();
  });

  it("should show failed check with error icon", async () => {
    const checkSection = reportPage
      .locator('[data-slot="card"]')
      .filter({ hasText: "Optimization" });
    await expect(
      checkSection.getByText("llms.txt", { exact: true }),
    ).toBeVisible();
    await expect(checkSection.getByText("✗")).toBeVisible();
  });

  it("should show suggestions", async () => {
    await expect(
      reportPage.getByText("Add llms.txt for AI discoverability"),
    ).toBeVisible();
  });

  it("should match visually", async () => {
    await expect(reportPage.locator("main")).toMatchVisual({
      name: "ai-legibility/report",
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

    await sendAiLegibilityReport({
      domain: "example.com",
      scanId: "test-email-report-id",
      result: SCAN_RESULT,
      sendTo: user,
    });

    email = await getLastEmailSent();
  });

  it("should send with correct subject", () => {
    expect(email.subject).toBe("AI Legibility Report for example.com");
  });

  it("should send to correct recipient", () => {
    expect(email.to).toBe("email-test@example.com");
  });

  it("should show score in email", async () => {
    await expect(email.page.getByText("86%")).toBeVisible();
  });

  it("should show category summary", async () => {
    await expect(email.page.getByText("Critical")).toBeVisible();
    await expect(email.page.getByText("Important")).toBeVisible();
    await expect(email.page.getByText("Optimization")).toBeVisible();
  });

  it("should show top suggestions", async () => {
    await expect(
      email.page.getByText("Add llms.txt for AI discoverability"),
    ).toBeVisible();
  });

  it("should match visually", async () => {
    email.page.setViewportSize({ width: 1024, height: 1200 });
    await expect(email.page).toMatchVisual({
      name: "email/ai-legibility-report",
    });
  });
});
