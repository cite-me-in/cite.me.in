// DO NOT add to setup.ts as vitest.config.js cannot upload file that imports vitest

import { access, constants, mkdir, readFile, writeFile } from "node:fs/promises";
import path, { dirname } from "node:path";
import { expect } from "@playwright/test";
import looksSame from "looks-same";
import type { Locator, Page } from "playwright";
import { baseDir, getTestName } from "./shared";

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
      toMatchScreenshot(options?: { name?: string; tolerance?: number }): Promise<R>;
    }
  }
}

const defaultTolerance = 10;

expect.extend({
  async toMatchScreenshot(
    locator: Locator | Page,
    options?: { name?: string; tolerance?: number },
  ): Promise<{ message: () => string; pass: boolean }> {
    const updateSnapshot = process.env.UPDATE_SNAPSHOT === "true";

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

    const createBaseline = async () => {
      await mkdir(dirname(filename), { recursive: true });
      await writeFile(filename, screenshot);
    };

    if (updateSnapshot) {
      await createBaseline();
      return {
        message: () => `Baseline screenshot updated at ${filename}.`,
        pass: true,
      };
    }

    if (process.env.CI)
      return {
        message: () => "Skipping screenshot comparison in CI",
        pass: true,
      };

    try {
      await access(filename, constants.R_OK);
    } catch {
      await createBaseline();
      return {
        message: () => `Baseline screenshot created at ${filename}.`,
        pass: true,
      };
    }
    const { diffImage, equal } = await looksSame(await readFile(filename), screenshot, {
      createDiffImage: true,
      ignoreAntialiasing: true,
      ignoreCaret: true,
      tolerance: options?.tolerance ?? defaultTolerance,
      strict: false,
    });

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

