import { expect } from "@playwright/test";
import { beforeAll, describe, it } from "vite-plus/test";
import sendAiLegibilityReport from "~/emails/AiLegibilityReport";
import { appendLog, startNewScan } from "~/lib/aiLegibility/progress.server";
import type { ScanResult } from "~/lib/aiLegibility/types";
import prisma from "~/lib/prisma.server";
import getLastEmailSent from "~/test/helpers/getLastEmailSent";
import { goto } from "~/test/helpers/launchBrowser";
import { port } from "~/test/helpers/launchServer";
import { signIn } from "~/test/helpers/signIn";
import "~/test/helpers/toMatchVisual";

const SCAN_RESULT: ScanResult = {
  url: "https://example.com",
  scannedAt: "2026-04-19T10:00:00.000Z",
  checks: [
    {
      name: "Homepage Content",
      category: "informative",
      passed: true,
      message: "Homepage has meaningful content (150+ characters)",
    },
    {
      name: "sitemap.txt",
      category: "discoverability",
      passed: true,
      message: "sitemap.txt found with 10 valid URLs",
    },
    {
      name: "sitemap.xml",
      category: "discoverability",
      passed: true,
      message: "sitemap.xml found with valid XML structure",
    },
    {
      name: "robots.txt",
      category: "bot-access",
      passed: true,
      message: "robots.txt found and references sitemap",
    },
    {
      name: "JSON-LD Structured Data",
      category: "informative",
      passed: true,
      message: "Found 2 valid JSON-LD schemas: Organization, WebSite",
    },
    {
      name: "Meta Tags",
      category: "informative",
      passed: true,
      message: "Found title, description, and Open Graph tags",
    },
    {
      name: "llms.txt",
      category: "discoverability",
      passed: false,
      message: "llms.txt not found (optional but recommended)",
    },
  ],
  summary: {
    discoverability: { passed: 2, total: 3 },
    informative: { passed: 3, total: 3 },
    "bot-access": { passed: 1, total: 1 },
  },
  suggestions: [
    {
      title: "Add llms.txt for AI discoverability",
      category: "discoverability",
      effort: "5 min",
      description:
        "Create an llms.txt file at the root of your site to provide structured context for LLMs. This helps AI agents understand your content better.",
      fixExample:
        "# Example Site\n\nMain description here.\n\n## Sections\n- /about\n- /pricing",
    },
    {
      title: "Add sitemap.txt",
      category: "discoverability",
      effort: "5 min",
      description:
        "Create a plain-text file at https://example.com/sitemap.txt with one URL per line listing all important pages on your site.",
      fixExample:
        '# 1. robots.txt — add a Sitemap line:\nSitemap: https://example.com/sitemap.txt\n\n# 2. HTML <head> — add a link tag:\n<link rel="sitemap" type="text/plain" title="Sitemap" href="/sitemap.txt">\n\n# sitemap.txt content:\nhttps://example.com/\nhttps://example.com/about\nhttps://example.com/products',
    },
    {
      title: "Add JSON-LD structured data",
      category: "informative",
      effort: "15 min",
      description:
        'Add a <script type="application/ld+json"> block to your pages with schema.org structured data to help AI agents understand your content.',
    },
    {
      title: "Fix meta description",
      category: "informative",
      effort: "2 min",
      description:
        "Add a meta description tag to your homepage to help AI agents summarize your content.",
    },
  ],
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

  it("should show check AI readability title", async () => {
    await expect(page.getByText("Check AI Readability")).toBeVisible();
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
        result: JSON.parse(JSON.stringify(SCAN_RESULT)),
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

  it("should show failed check with error icon", async () => {
    await expect(reportPage.getByText("✗").first()).toBeVisible();
    await expect(reportPage.getByText("llms.txt").first()).toBeVisible();
  });

  it("should show suggestions", async () => {
    await expect(
      reportPage.getByText("Add llms.txt for AI discoverability"),
    ).toBeVisible();
    await expect(reportPage.getByText("Add sitemap.txt")).toBeVisible();
    await expect(reportPage.getByText("Fix meta description")).toBeVisible();
  });

  it("should show run new scan button", async () => {
    await expect(
      reportPage.getByRole("button", { name: "Run New Scan" }),
    ).toBeVisible();
  });

  it("should match visually - results", async () => {
    await reportPage.waitForTimeout(600);
    await expect(reportPage.locator("main")).toMatchVisual({
      name: "ai-legibility/results",
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
    });

    await sendAiLegibilityReport({
      site: { id: site.id, domain: site.domain },
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
    await expect(email.page.getByText("86%")).toBeVisible();
  });

  it("should show category summary", async () => {
    const table = email.page.locator("table");
    await expect(
      table.getByText("Discoverability", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      table.getByText("Informative", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      table.getByText("Bot Access", { exact: true }).first(),
    ).toBeVisible();
  });

  it("should show top suggestions", async () => {
    await expect(
      email.page.getByText("Add llms.txt for AI discoverability"),
    ).toBeVisible();
  });

  it("should show code block for fix example", async () => {
    const codeBlock = email.page.locator("pre").first();
    await expect(codeBlock).toBeVisible();
    await expect(codeBlock).toContainText("# Example Site");
  });

  it("should show link to view all suggestions", async () => {
    await expect(email.page.getByText("View all 4 suggestions")).toBeVisible();
  });

  it("should match visually", async () => {
    await email.page.setViewportSize({ width: 1024, height: 2400 });
    await expect(email.page).toMatchVisual({
      name: "email/ai-legibility-report",
    });
  });
});
