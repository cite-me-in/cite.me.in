// DO NOT add to setup.ts as vitest.config.js cannot upload file that imports vitest

import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path, { dirname } from "node:path";
import { expect } from "@playwright/test";
import looksSame from "looks-same";
import type { Locator, Page } from "playwright";
import { baseDir } from "./toMatchVisual";

declare global {
  namespace PlaywrightTest {
    interface Matchers<R> {
      /**
       * Click a trigger element (button), capture the resulting download,
       * and compare the downloaded PNG against a baseline. If no baseline
       * exists, the downloaded file becomes the baseline.
       *
       * @param options.name - Required baseline filename (e.g. `"ai-legibility/share-image"`)
       * @param options.trigger - The locator to click (e.g. `page.getByRole("button", { name: /share/i })`)
       * @param options.tolerance - Image comparison tolerance (default: 10)
       */
      toMatchDownload(options: {
        name: string;
        trigger: Locator;
        tolerance?: number;
      }): Promise<R>;
    }
  }
}

const defaultTolerance = 10;

expect.extend({
  async toMatchDownload(
    page: Page,
    options: { name: string; trigger: Locator; tolerance?: number },
  ): Promise<{ message: () => string; pass: boolean }> {
    if (process.env.CI)
      return {
        message: () => "Skipping download comparison in CI",
        pass: true,
      };

    const name = options.name;
    const filename = path.resolve(baseDir, `${name}.png`);
    const newFilename = path.resolve(baseDir, `${name}.new.png`);
    const diffFilename = path.resolve(baseDir, `${name}.diff.png`);

    const downloadPromise = page.waitForEvent("download");
    await options.trigger.click();
    const download = await downloadPromise;

    await unlink(newFilename).catch(() => {});
    await download.saveAs(newFilename);

    const newBuf = await readFile(newFilename);

    if (newBuf[0] !== 0x89 || newBuf[1] !== 0x50) {
      await unlink(newFilename).catch(() => {});
      return {
        message: () => `Downloaded file is not a valid PNG`,
        pass: false,
      };
    }

    let baseline: Buffer;
    try {
      baseline = await readFile(filename);
    } catch {
      await mkdir(dirname(filename), { recursive: true });
      await writeFile(filename, newBuf);
      await unlink(newFilename).catch(() => {});
      return {
        message: () => `Baseline created at ${filename}`,
        pass: true,
      };
    }

    const { equal } = await looksSame(baseline, newBuf, {
      ignoreAntialiasing: true,
      ignoreCaret: true,
      tolerance: options.tolerance ?? defaultTolerance,
      strict: false,
    });

    if (!equal) {
      const { diffImage } = await looksSame(baseline, newBuf, {
        createDiffImage: true,
        tolerance: 0,
      });
      if (diffImage) await diffImage.save(diffFilename);
      return {
        message: () =>
          `Downloaded image differs from baseline — see ${diffFilename}`,
        pass: false,
      };
    }

    await unlink(newFilename).catch(() => {});
    return { message: () => "Image matches baseline", pass: true };
  },
});
