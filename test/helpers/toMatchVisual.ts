// DO NOT add to setup.ts as vitest.config.js cannot upload file that imports vitest

import { expect } from "@playwright/test";
import { invariant } from "es-toolkit";
import { readdirSync, unlinkSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { Locator, Page } from "playwright";
import type { HTMLNode } from "~/lib/html/HTMLNode";
import "~/test/helpers/toMatchInnerHTML";
import "~/test/helpers/toMatchScreenshot";
import vitestConfig from "../../vitest.config";

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

expect.extend({
  async toMatchVisual(
    locator: Locator | Page,
    options?: {
      name?: string;
      tolerance?: number;
      modify?: (html: HTMLNode[]) => void;
    },
  ): Promise<{ message: () => string; pass: boolean }> {
    const name = options?.name ?? getTestName();
    await expect(locator).toMatchScreenshot({
      name,
      tolerance: options?.tolerance ?? 10,
    });
    await expect(locator).toMatchInnerHTML({ name, modify: options?.modify });
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

const dirname = path.resolve(
  vitestConfig.test?.browser?.screenshotDirectory ?? "",
);

export async function removeTemporaryFiles() {
  await mkdir(dirname, { recursive: true });
  const list = readdirSync(dirname);
  for (const file of list) {
    if (
      file.endsWith(".diff.png") ||
      file.endsWith(".new.png") ||
      file.endsWith(".new.html") ||
      file.endsWith(".html.diff")
    )
      unlinkSync(path.resolve(dirname, file));
  }
}
