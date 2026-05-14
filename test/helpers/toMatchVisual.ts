// DO NOT add to setup.ts as vitest.config.js cannot upload file that imports vitest

import { readdirSync, unlinkSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect } from "@playwright/test";
import type { Locator, Page } from "playwright";
import { sleep } from "radashi";
import { baseDir, getTestName } from "./shared";
import "~/test/helpers/toMatchInnerHTML";
import "~/test/helpers/toMatchScreenshot";

declare global {
  namespace PlaywrightTest {
    interface Matchers<R> {
      /**
       * Takes a screenshot of the page and compares it to the baseline
       * screenshot, and compares the HTML of the page to the baseline HTML.
       *
       * @param options - The options for the matcher.
       * @param options.name - The name of the test.
       * @param options.modify - A function to modify the HTML of any desired content.
       * @param options.tolerance - The tolerance for the matcher (default: 3.5).
       * @example
       * await expect(page).toMatchVisual();
       */
      toMatchVisual(options?: {
        name?: string;
        tolerance?: number;
        modify?: (doc: Document) => void;
      }): Promise<R>;
    }
  }
}

expect.extend({
  async toMatchVisual(
    locator: Locator | Page,
    options?: {
      name?: string;
      tolerance?: number;
      modify?: (doc: Document) => void;
    },
  ): Promise<{ message: () => string; pass: boolean }> {
    const name = options?.name || getTestName();

    // Wait for the page to finish rendering/animations before capturing screenshots or HTML.
    // This can use Playwright's waitForLoadState and a small additional delay for UI transitions.
    if ("waitForLoadState" in locator && typeof locator.waitForLoadState === "function") {
      await locator.waitForLoadState("networkidle");
      await locator.evaluate(() => document.fonts.ready);
    }
    // Wait for all possible animations/transitions (tweak ms if needed for your UI)
    await sleep(200);

    // Freeze CSS animations to ensure deterministic screenshots
    await (locator as Page).evaluate(() => {
      if (document.getElementById("pw-animation-freeze")) return;
      const style = document.createElement("style");
      style.id = "pw-animation-freeze";
      style.textContent =
        "*, *::before, *::after { animation: none !important; transition: none !important; }";
      document.head.appendChild(style);
    });

    // Run both matchers in parallel and fail if either fails.
    const [screenshot, html] = await Promise.allSettled([
      expect(locator).toMatchScreenshot({ name, ...options }),
      expect(locator).toMatchInnerHTML({ name, ...options }),
    ]);
    if (screenshot.status === "rejected") throw new Error(screenshot.reason.message);
    if (html.status === "rejected") throw new Error(html.reason.message);

    return { message: () => "Visual matches baseline", pass: true };
  },
});

export async function removeTemporaryFiles() {
  await mkdir(baseDir, { recursive: true });
  const list = readdirSync(baseDir);
  for (const file of list) {
    if (
      file.endsWith(".diff.png") ||
      file.endsWith(".new.png") ||
      file.endsWith(".new.html") ||
      file.endsWith(".html.diff")
    )
      unlinkSync(path.resolve(baseDir, file));
  }
}
