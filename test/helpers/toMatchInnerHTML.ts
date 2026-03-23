// DO NOT add to setup.ts as vitest.config.js cannot upload file that imports vitest

import { expect } from "@playwright/test";
import { invariant } from "es-toolkit";
import {
  access,
  constants,
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import path, { dirname } from "node:path";
import type { Locator, Page } from "playwright";
import diffHTMLs from "~/lib/html/diffHTMLs";
import formatHTMLTree from "~/lib/html/formatHTML";
import type { HTMLNode } from "~/lib/html/HTMLNode";
import parseHTMLTree from "~/lib/html/parseHTML";
import vitestConfig from "../../vitest.config";
import { baseDir } from "./toMatchVisual";

declare global {
  namespace PlaywrightTest {
    interface Matchers<R> {
      /**
       * Takes the inner HTML of the page and compares it to the baseline HTML.
       *
       * @param options - The options for the matcher.
       * @param options.name - The name of the test.
       * @param options.modify - A function to modify the HTML of any desired content.
       * @example
       * await expect(page).toMatchInnerHTML();
       */
      toMatchInnerHTML(options?: {
        name?: string;
        modify?: (html: HTMLNode[]) => void;
      }): Promise<R>;
    }
  }
}

expect.extend({
  async toMatchInnerHTML(
    locator: Locator | Page,
    options?: { name?: string; modify?: (html: HTMLNode[]) => void },
  ): Promise<{ message: () => string; pass: boolean }> {
    const name = options?.name || getTestName();
    const filename = path.resolve(baseDir, `${name}.html`);
    const rawHtml =
      "content" in locator
        ? await (locator as unknown as Page).innerHTML("body")
        : await locator.innerHTML();

    const html = parseHTMLTree(rawHtml);
    if (options?.modify) options.modify(html);
    const formattedHtml = formatHTMLTree(html);

    try {
      if (vitestConfig.test?.update) throw new Error("Update is enabled");
      await access(filename, constants.R_OK);
    } catch {
      await mkdir(dirname(filename), { recursive: true });
      await writeFile(filename, formattedHtml);
      return {
        message: () => `Baseline HTML created at ${filename}.`,
        pass: true,
      };
    }

    const original = await readFile(filename, "utf-8");
    if (formattedHtml !== original) {
      const newFilename = path.resolve(baseDir, `${name}.new.html`);
      await writeFile(newFilename, formattedHtml);

      const diff = diffHTMLs(original, formattedHtml);
      await writeFile(path.resolve(baseDir, `${name}.html.diff`), diff);

      return {
        message: () => `HTML differs from baseline see ${newFilename}\n${diff}`,
        pass: false,
      };
    }
    return { message: () => "HTML matches baseline", pass: true };
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
