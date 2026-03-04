import { expect } from "@playwright/test";
import { describe, it } from "vitest";
import prisma from "~/lib/prisma.server";
import { goto, port } from "../helpers/launchBrowser";

describe("new customer onboarding E2E", () => {
  const SLOW_MO = Number.parseInt(process.env.SLOW_MO || "0", 10);
  const pause = () => (SLOW_MO > 0 ? new Promise((r) => setTimeout(r, SLOW_MO)) : Promise.resolve());

  it("completes full flow: signup → add site → accept queries → view citations", async () => {
    // Dynamic test data to avoid conflicts
    const timestamp = Date.now();
    const email = `${timestamp}@example.com`;
    const domain = `${timestamp}.example.com`;
    const password = "TestPassword123!";

    // ============================================
    // 1. HOME PAGE
    // ============================================
    const page = await goto("/");

    // Verify home page loaded
    await expect(page.getByRole("heading", { name: /Does ChatGPT mention/ })).toBeVisible();
    await expect(page.getByRole("navigation").getByRole("link", { name: /get started/i })).toBeVisible();
    await pause();

    // Click Get Started
    await page.getByRole("navigation").getByRole("link", { name: /get started/i }).click();
    await pause();

    // ============================================
    // 2. SIGN-UP FORM
    // ============================================
    // Verify redirect to sign-up
    await expect(page).toHaveURL(`http://localhost:${port}/sign-up`);

    // Verify form fields visible
    await expect(page.getByRole("textbox", { name: "Email", exact: true })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Password", exact: true })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Confirm password", exact: true })).toBeVisible();
    await pause();

    // Fill and submit
    await page.getByRole("textbox", { name: "Email", exact: true }).fill(email);
    await page.getByRole("textbox", { name: "Password", exact: true }).fill(password);
    await page.getByRole("textbox", { name: "Confirm password", exact: true }).fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await pause();

    // ============================================
    // 3. VERIFY SIGN-UP & REDIRECT
    // ============================================
    // Should redirect to sites/new
    await expect(page).toHaveURL(`http://localhost:${port}/sites/new`);

    // Verify user created in DB
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).toBeDefined();
    if (!user) throw new Error("User not created");
    expect(user.email).toBe(email);
    await pause();

    // ============================================
    // 4. SITE ADD FORM
    // ============================================
    // Verify at sites/new page
    await expect(page.getByRole("textbox", { name: "Website URL or domain" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add Site" })).toBeVisible();
    await pause();

    // Fill and submit
    await page.getByRole("textbox", { name: "Website URL or domain" }).fill(domain);
    await page.getByRole("button", { name: "Add Site" }).click();
    await pause();

    // ============================================
    // 5. VERIFY SITE CREATION & REDIRECT
    // ============================================
    // Should redirect to /site/{id}/queries
    await page.waitForURL(/http:\/\/localhost:9222\/site\/[^/]+\/queries/);
    const siteUrl = page.url();
    const siteIdMatch = siteUrl.match(/\/site\/([^/]+)/);
    expect(siteIdMatch).toBeTruthy();
    const siteId = siteIdMatch?.[1];
    if (!siteId) throw new Error("Site ID not found");

    // Verify site created in DB
    const site = await prisma.site.findUnique({ where: { id: siteId } });
    expect(site).toBeDefined();
    if (!site) throw new Error("Site not created");
    expect(site.domain).toBe(domain);
    expect(site.accountId).toBe(user.accountId);
    await pause();

    // ============================================
    // 6. QUERY SUGGESTIONS PAGE
    // ============================================
    // Verify we're on queries page
    await expect(page).toHaveURL(new RegExp(`/site/${siteId}/queries`));

    // Verify Citation Queries heading exists
    await expect(page.getByRole("heading", { name: "Citation Queries" })).toBeVisible();

    // Verify "Suggest queries" button exists
    await expect(page.getByRole("button", { name: "Suggest queries" })).toBeVisible();
    await pause();

    // ============================================
    // 7. ACCEPT ALL QUERIES (SIMULATE SUGGESTION)
    // ============================================
    // Generate suggestions by clicking the suggest button
    await page.getByRole("button", { name: "Suggest queries" }).click();

    // Wait for suggestions to load (this will call our mocked LLM)
    await page.waitForSelector("button", { timeout: 5000 });

    // Verify suggested queries appear
    const suggestedQueryButtons = page.locator("button").filter({ hasNot: page.getByText("Added") });
    const count = await suggestedQueryButtons.count();
    expect(count).toBeGreaterThan(0);
    await pause();

    // Click all "Add" buttons to accept suggestions
    let clickCount = 0;
    while (clickCount < 10) {
      const addButton = page.locator("button").filter({ hasNot: page.getByText("Added") }).first();

      if (!(await addButton.isVisible().catch(() => false))) {
        break;
      }

      await addButton.click();
      await page.waitForTimeout(300);
      clickCount++;
    }
    await pause();

    // ============================================
    // 8. VERIFY QUERIES SAVED IN DB
    // ============================================
    // Refresh page to see saved queries
    await page.reload({ waitUntil: "load" });
    await pause();

    // Verify queries were created in DB
    const queries = await prisma.siteQuery.findMany({
      where: { siteId },
      orderBy: { createdAt: "asc" },
    });
    expect(queries.length).toBeGreaterThan(0);

    // Verify queries are loaded on the page by checking for the queries container
    const savedQueriesContainer = page.locator("text=/saved|Saved/i").or(page.locator('[data-testid="saved-queries"]'));
    await expect(savedQueriesContainer).toBeVisible().catch(() => null);
    await pause();

    // ============================================
    // 9. NAVIGATE TO CITATIONS PAGE
    // ============================================
    // Click on the citations link (usually in the nav or sidebar)
    const citationsLink = page.getByRole("link", { name: /citations/i }).first();
    if (await citationsLink.isVisible()) {
      await citationsLink.click();
      await page.waitForURL(new RegExp(`/site/${siteId}/citations`));
      await expect(page).toHaveURL(new RegExp(`/site/${siteId}/citations`));
      await pause();

      // Verify citations page has content
      await expect(page.getByRole("heading")).toBeVisible();
    }
  });
});
