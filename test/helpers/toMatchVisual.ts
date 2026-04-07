// DO NOT add to setup.ts as vitest.config.js cannot upload file that imports vitest

import type { Locator, Page } from "playwright";
import type { HTMLNode } from "~/lib/html/HTMLNode";
import { readdirSync, unlinkSync } from "node:fs";
import { expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { sleep } from "radashi";
import vitestConfig from "../../vitest.config";
import invariant from "tiny-invariant";
import path from "node:path";
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
        modify?: (html: HTMLNode[]) => void;
      }): Promise<R>;
    }
  }
}

export const baseDir = path.resolve(
  vitestConfig.test?.browser?.screenshotDirectory ?? "",
);

expect.extend({
  async toMatchVisual(
    locator: Locator | Page,
    options?: {
      name?: string;
      tolerance?: number;
      modify?: (html: HTMLNode[]) => void;
    },
  ): Promise<{ message: () => string; pass: boolean }> {
    const name = options?.name || getTestName();

    // Wait for the page to finish rendering/animations before capturing screenshots or HTML.
    // This can use Playwright's waitForLoadState and a small additional delay for UI transitions.
    if (
      "waitForLoadState" in locator &&
      typeof locator.waitForLoadState === "function"
    )
      await locator.waitForLoadState("networkidle");
    // Wait for all possible animations/transitions (tweak ms if needed for your UI)
    await sleep(200);

    // Run both matchers in parallel and fail if either fails.
    const [screenshot, html] = await Promise.allSettled([
      expect(locator).toMatchScreenshot({ name, ...options }),
      expect(locator).toMatchInnerHTML({ name, ...options }),
    ]);
    if (screenshot.status === "rejected")
      throw new Error(screenshot.reason.message);
    if (html.status === "rejected") throw new Error(html.reason.message);

    return { message: () => "Visual matches baseline", pass: true };
  },
});

function getTestName(): string {
  const error = new Error();
  const stackLines = error.stack?.split("\n") || [];
  const callerLine = stackLines.find(
    (line) => line.includes(".test.") && !line.includes("node_modules"),
  );
  invariant(callerLine, "Could not determine test file name");
  const match = callerLine.match(/\/(.+?):\d+/);
  const testFile = match ? path.basename(match[1]) : "unknown";
  return testFile.replace(/\.test\.(ts|tsx)$/, "");
}

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
