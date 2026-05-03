/**
 * Spec: robots meta tag (HTML spec) + X-Robots-Tag header (Google)
 * Pages can prevent indexing via:
 *   <meta name="robots" content="noindex, nofollow">
 *   X-Robots-Tag: noindex
 * AI agents respect these directives — noindex means the page won't appear
 * in the agent's knowledge base.
 * Required: ALL reviewed pages must NOT return noindex.
 */

import { parseHTML } from "linkedom";
import type { CheckResult } from "~/lib/aiLegibility/types";

const NOINDEX_PATTERNS = [/\bnoindex\b/i, /\bnone\b/i];

function hasNoindexInHtml(html: string): boolean {
  const { document } = parseHTML(html);
  const meta = document.querySelector(
    'meta[name="robots"], meta[name="ROBOTS"]',
  ) as HTMLMetaElement | null;
  if (!meta) return false;
  const content = meta.getAttribute("content");
  if (!content) return false;
  return NOINDEX_PATTERNS.some((p) => p.test(content));
}

function hasNoindexInHeader(xRobotsTag: string | null): boolean {
  if (!xRobotsTag) return false;
  return NOINDEX_PATTERNS.some((p) => p.test(xRobotsTag));
}

export default async function checkRobotsDirectives({
  pages,
}: {
  pages: {
    headers?: Headers;
    html: string;
    url: string;
  }[];
}): Promise<Omit<CheckResult, "category">> {
  const noindexPages = pages.flatMap((page) => {
    const metaTag = hasNoindexInHtml(page.html);
    const xRobotsTag = hasNoindexInHeader(
      page.headers?.get("X-Robots-Tag") ?? null,
    );
    return metaTag || xRobotsTag
      ? [{ url: page.url, metaTag, xRobotsTag }]
      : [];
  });

  if (noindexPages.length === 0) {
    const sampleCount = pages.length;
    return {
      name: "Robots directives",
      passed: true,
      message: `No noindex directives found on any of ${sampleCount} reviewed page${sampleCount === 1 ? "" : "s"}`,
      details: {
        pagesChecked: pages.length,
      },
    };
  }

  const parts = noindexPages.map((page) => {
    const sources: string[] = [];
    if (page.metaTag) sources.push("meta robots");
    if (page.xRobotsTag) sources.push("X-Robots-Tag");
    return `${page.url}: ${sources.join(" + ")}`;
  });

  return {
    name: "Robots directives",
    passed: false,
    message: `noindex found on ${noindexPages.length} page${noindexPages.length === 1 ? "" : "s"}: ${parts.join("; ")}`,
    details: {
      noindexPages,
      pagesChecked: pages.length,
    },
  };
}
