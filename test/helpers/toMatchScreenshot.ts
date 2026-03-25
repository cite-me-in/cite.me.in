// DO NOT add to setup.ts as vitest.config.js cannot upload file that imports vitest

import { expect } from "@playwright/test";
import { invariant } from "es-toolkit";
import looksSame from "looks-same";
import {
  access,
  constants,
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import path, { dirname } from "node:path";
import type { Locator, Page } from "playwright";
import { baseDir } from "./toMatchVisual";

declare global {
  namespace PlaywrightTest {
    interface Matchers<R> {
      /**
       * Take a screenshot of the page and compare it to the baseline screenshot.
       *
       * @param options - The options for the matcher.
       * @param options.name - The name of the test.
       * @param options.tolerance - The tolerance for the matcher (default: 2.3).
       * @example
       * await expect(page).toMatchScreenshot();
       */
      toMatchScreenshot(options?: {
        name?: string;
        tolerance?: number;
      }): Promise<R>;
    }
  }
}

const defaultTolerance = 10;

expect.extend({
  async toMatchScreenshot(
    locator: Locator | Page,
    options?: { name?: string; tolerance?: number },
  ): Promise<{ message: () => string; pass: boolean }> {
    if (process.env.CI)
      return {
        message: () => "Skipping screenshot comparison in CI",
        pass: true,
      };

    const name = options?.name || getTestName();
    const filename = path.resolve(baseDir, `${name}.png`);
    const chartLocators = await locator.locator('[data-slot="chart"]').all();
    const screenshot = await locator.screenshot({
      animations: "disabled",
      caret: "hide",
      scale: "css",
      type: "png",
      mask: chartLocators,
    });

    try {
      await access(filename, constants.R_OK);
    } catch {
      await mkdir(dirname(filename), { recursive: true });
      await writeFile(filename, screenshot);
      return {
        message: () => `Baseline screenshot created at ${filename}.`,
        pass: true,
      };
    }
    const { diffImage, equal } = await looksSame(
      await readFile(filename),
      screenshot,
      {
        createDiffImage: true,
        ignoreAntialiasing: true,
        ignoreCaret: true,
        tolerance: options?.tolerance ?? defaultTolerance,
        strict: false,
      },
    );

    if (!equal) {
      const diffFilename = path.resolve(baseDir, `${name}.diff.png`);
      await diffImage.save(diffFilename);
      await writeFile(path.resolve(baseDir, `${name}.new.png`), screenshot);
      return {
        message: () => `Image differs from baseline see ${diffFilename}`,
        pass: false,
      };
    }

    return { message: () => "Image matches baseline", pass: true };
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
