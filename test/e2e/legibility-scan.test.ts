import test, { type Page, expect } from "@playwright/test";
import { goto } from "~/test/helpers/launchBrowser";
import "~/test/helpers/toMatchVisual";

let page: Page;

test.beforeEach(async () => {
  page = await goto("/");
});

test("shows the scan form on /try", async () => {
  page = await goto("/try");
  await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("main")).toMatchVisual({
    name: "e2e/legibility-scan/1.form",
  });
});

test("shows scan results with passing and failing checks", async () => {
  page = await goto("/try?domain=acme.com");

  // Wait for scan to start
  await expect(page.getByText("Page content")).toBeVisible({
    timeout: 20_000,
  });

  // Wait for "Starting scan..." to disappear and results to appear
  await page.waitForSelector(".grid.gap-3.sm\\:grid-cols-2 > div", {
    timeout: 15_000,
  });

  // Wait for all animations to complete
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);

  await expect(page.locator("main")).toMatchVisual({
    name: "e2e/legibility-scan/2.checks",
  });
});

test("shows the full scan result including CTA", async () => {
  page = await goto("/try?domain=acme.com");

  // Wait for scan to complete - check for the score heading
  await expect(page.getByText(/AI Legibility Score/)).toBeVisible({
    timeout: 40_000,
  });

  // Wait for loading spinner to disappear (if present)
  try {
    await page.waitForSelector(".animate-spin", {
      state: "hidden",
      timeout: 40_000,
    });
  } catch {
    // Spinner might not be present if scan was fast
  }

  // Wait for all animations to complete
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1000);

  await page.locator("#scan-results").scrollIntoViewIfNeeded();
  await expect(page.locator("main")).toMatchVisual({
    name: "e2e/legibility-scan/3.final",
  });
});
