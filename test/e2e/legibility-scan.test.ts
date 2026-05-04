import test, { type Page, expect } from "@playwright/test";
import { goto } from "~/test/helpers/launchBrowser";
import "~/test/helpers/toMatchVisual";

let page: Page;

test("shows the scan form on /try", async () => {
  page = await goto("/try");
  await expect(page.locator("main")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("main")).toMatchVisual({
    name: "e2e/legibility-scan/1.form",
  });
});

test("shows scan results with passing and failing checks", async () => {
  page = await goto("/try?domain=acme.com");

  await expect(page.getByText("Page content")).toBeVisible({
    timeout: 20_000,
  });

  await expect(page.locator("main")).toMatchVisual({
    name: "e2e/legibility-scan/2.checks",
  });
});

test("shows the full scan result including CTA", async () => {
  page = await goto("/try?domain=acme.com");
  await expect(page.getByText(/AI Legibility Score/)).toBeVisible({
    timeout: 40_000,
  });
  await page.locator("#scan-results").scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await expect(page.locator("main")).toMatchVisual({
    name: "e2e/legibility-scan/3.final",
  });
});
