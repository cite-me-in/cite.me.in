/**
 * Spec: AI agent compatibility — pages that rely on client-side JavaScript
 * rendering may appear empty to AI agents that don't execute JS.
 * Detects JS-rendered content patterns: empty <body> with script-loaded
 * content, client-side routing indicators, and DOM manipulation patterns.
 * Required: at least one reviewed page should not rely solely on JS rendering.
 */

import { parseHTML } from "linkedom";
import type { CheckResult } from "~/lib/aiLegibility/types";

const JS_RENDERED_PATTERNS = [
  /<div\s+id\s*=\s*["'](root|app|__next|__nuxt|___gatsby|svelte|__svelte|react-root|app-root|application-root)["']/i,
  /<div\s+class\s*=\s*["']app["']/i,
  /<script[^>]*src\s*=\s*["']\/?(main|bundle|app|index)\.[a-z0-9]+\.js["']/i,
  /<script[^>]*src\s*=\s*["']\/?(vendor|runtime|chunk)\.[a-z0-9]+\.js["']/i,
];

const HTML_ROUTING_PATTERNS = [
  /<a[^>]+href\s*=\s*["']\/[^"']*["']/i,
  /<link[^>]+rel\s*=\s*["']canonical["']/i,
];

type PageResult = {
  url: string;
  passed: boolean;
  jsRendered: boolean;
  signals: string[];
};

export default async function checkJsRenderedContent({
  pages,
}: {
  pages: { url: string; html: string }[];
}): Promise<Omit<CheckResult, "category">> {
  const pageResults: PageResult[] = [];
  let totalJsRendered = 0;

  for (const page of pages) {
    const { document } = parseHTML(page.html);
    const body = document.querySelector("body");
    const bodyText = (body?.textContent ?? "").replace(/\s+/g, " ").trim();

    const signals: string[] = [];

    for (const pattern of JS_RENDERED_PATTERNS) {
      if (pattern.test(page.html))
        signals.push(`matches pattern: ${pattern.source.slice(0, 40)}`);
    }

    if (bodyText.length < 50 && signals.length > 0)
      signals.push("empty body with JS patterns");

    if (!HTML_ROUTING_PATTERNS.some((p) => p.test(page.html)))
      signals.push("no HTML routing found");

    const jsRendered = signals.length >= 2;
    if (jsRendered) totalJsRendered++;

    pageResults.push({
      url: page.url,
      passed: !jsRendered,
      jsRendered,
      signals,
    });
  }

  const passed = totalJsRendered === 0;

  return {
    name: "JS-rendered content",
    passed,
    message: passed
      ? `All ${pageResults.length} pages have static content visible to AI agents`
      : `${totalJsRendered}/${pageResults.length} pages appear JS-rendered — AI agents may see empty content`,
    details: {
      totalPages: pageResults.length,
      jsRenderedCount: totalJsRendered,
      pageResults,
    },
  };
}
