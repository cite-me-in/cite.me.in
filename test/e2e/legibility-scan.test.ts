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

  // Wait for scan results to appear after the progress→results CSS transition chain.
  await page.waitForSelector("text=AI Legibility Report", { timeout: 10_000 });

  // Wait for the results container to become visible (pointer-events: auto = resultVisible).
  // The transition chain takes hold=300ms + fade=100ms in test mode before results appear.
  await page.waitForFunction(
    () => {
      const el = document.querySelector(
        '#scan-results div[style*="pointer-events: auto"]',
      );
      return el !== null;
    },
    { timeout: 5_000 },
  );

  await page.evaluate(() => document.fonts.ready);
  await page.locator("#scan-results").scrollIntoViewIfNeeded();
  await expect(page.locator("main")).toMatchVisual({
    name: "e2e/legibility-scan/3.final",
    // "Starting scan..." spinner is SSR-rendered and remains in the DOM inside
    // the collapsed progress wrapper. Strip its entire card from the comparison.
    modify: (doc) => {
      for (const el of doc.querySelectorAll('[data-slot="card-title"]')) {
        if (el.textContent?.includes("Starting scan"))
          el.closest('[data-slot="card"]')?.remove();
      }
    },
  });
});
