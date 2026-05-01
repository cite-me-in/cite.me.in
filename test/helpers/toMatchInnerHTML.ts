// DO NOT add to setup.ts as vitest.config.js cannot upload file that imports vitest

import {
  access,
  constants,
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import path, { dirname } from "node:path";
import { expect } from "@playwright/test";
import { diffLines } from "diff";
import { parseHTML } from "linkedom";
import type { Locator, Page } from "playwright";
import invariant from "tiny-invariant";
import { baseDir } from "./toMatchVisual";

declare global {
  namespace PlaywrightTest {
    interface Matchers<R> {
      toMatchInnerHTML(options?: {
        name?: string;
        modify?: (doc: Document) => void;
      }): Promise<R>;
    }
  }
}

expect.extend({
  async toMatchInnerHTML(
    locator: Locator | Page,
    options?: { name?: string; modify?: (doc: Document) => void },
  ): Promise<{ message: () => string; pass: boolean }> {
    const name = options?.name || getTestName();
    const filename = path.resolve(baseDir, `${name}.html`);
    const rawHtml =
      "page" in locator
        ? await locator.innerHTML()
        : await (locator as Page).innerHTML("body");

    const doc = parseHTML(rawHtml).document;
    if (options?.modify) options.modify(doc);
    const formattedHtml = formatHTMLTree(doc);

    try {
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

function formatHTMLTree(doc: Document): string {
  const parts: string[] = [];

  function formatNode(node: Node, indent = 0): void {
    const pad = "  ".repeat(indent);

    if (node.nodeType === 3) {
      const text = (node as Text).textContent ?? "";
      const escaped = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      parts.push(pad + escaped);
    } else if (node.nodeType === 1) {
      const el = node as Element;
      const tag = el.tagName.toLowerCase();

      const attrs = [...el.attributes]
        .sort((a, b) => a.name.localeCompare(b.name))
        .filter(
          (attr) =>
            !(
              (attr.name === "id" || attr.name === "for") &&
              attr.value?.match(/^_r_\d+_$/)
            ),
        )
        .map((attr) =>
          attr.value === ""
            ? attr.name
            : `${attr.name}="${attr.value.replace(/"/g, "&quot;")}"`,
        )
        .join(" ");

      const tagOpen = attrs ? `<${tag} ${attrs}>` : `<${tag}>`;

      if (!el.childNodes.length) {
        if (
          /^(area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr)$/i.test(
            tag,
          )
        ) {
          parts.push(pad + (attrs ? `<${tag} ${attrs} />` : `<${tag} />`));
        } else {
          parts.push(`${pad + tagOpen}</${tag}>`);
        }
        return;
      }

      parts.push(pad + tagOpen);
      for (const child of el.childNodes) formatNode(child, indent + 1);
      parts.push(`${pad}</${tag}>`);
    }
  }

  if (doc.childNodes.length === 1 && doc.firstChild?.nodeType === 1) {
    formatNode(doc.firstChild as Element, 0);
  } else {
    for (const child of doc.childNodes) formatNode(child, 0);
  }

  return parts.join("\n");
}

function diffHTMLs(html: string, original: string): string {
  const diffs = diffLines(html, original, { ignoreWhitespace: true });
  return diffs
    .map((diff) => (diff.added || diff.removed ? multipleLines(diff) : null))
    .filter(Boolean)
    .join("\n");
}

function multipleLines({
  added,
  count,
  value,
}: {
  added: boolean;
  count: number;
  value: string;
}) {
  return [
    added ? `added: ${count}` : `removed: ${count}`,
    ...value.split("\n").map((line) => (added ? `+ ${line}` : `- ${line}`)),
  ].join("\n");
}

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
