import test, { type Page, expect } from "@playwright/test";
import { goto } from "~/test/helpers/launchBrowser";
import { startScreencast, stopScreencast } from "~/test/helpers/screencast";
import "~/test/helpers/toMatchVisual";

let page: Page;

test.beforeAll(async () => {
  page = await goto("/try?domain=acme.com");
  await startScreencast(page, "legibility-scan/screencast", {
    size: { width: 1024, height: 2500 },
  });
});

test("shows scan page with domain badge", async () => {
  await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("main")).toMatchVisual({
    name: `legibility-scan/1.scanning`,
  });
});

test("displays scan progress and results", async () => {
  // Wait for scan to complete by checking for a UI element indicating scan result (adapt selector as needed)
  await expect(
    page.getByText(/scan complete|scan finished|results/i),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("main")).toMatchVisual({
    name: `legibility-scan/2.result`,
  });
});

test("shows CTA section after scrolling", async () => {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(100);
  await expect(page.locator("main")).toMatchVisual({
    name: `legibility-scan/3.cta`,
  });
});

test.afterAll(async () => {
  await stopScreencast(page);
});
