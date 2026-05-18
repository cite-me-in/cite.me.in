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
  await expect(page.locator("div.grid").getByText("Page content")).toBeVisible({
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
  test.setTimeout(60_000); // 60s for full scan
  page = await goto("/try?domain=acme.com");

  // Wait for scan to complete
  await page.waitForSelector("text=Scan complete", {
    timeout: 50_000,
  });

  // Wait for the progress section to finish collapsing (300ms hold + 500ms transition)
  // before results fade in — wait until the progress div actually reaches opacity 0
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[class*="max-h-0"][class*="opacity-0"]');
      if (!el) return false;
      // Verify transition is complete by checking computed opacity
      const style = getComputedStyle(el);
      return style.opacity === "0";
    },
    { timeout: 10_000 },
  );

  await page.evaluate(() => document.fonts.ready);
  await page.locator("#scan-results").scrollIntoViewIfNeeded();
  await expect(page.locator("main")).toMatchVisual({
    name: "e2e/legibility-scan/3.final",
  });
});
