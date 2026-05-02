/**
 * Spec: robots meta tag (HTML spec) + X-Robots-Tag header (Google)
 * Pages can prevent indexing via:
 *   <meta name="robots" content="noindex, nofollow">
 *   X-Robots-Tag: noindex
 * AI agents respect these directives — noindex means the page won't appear
 * in the agent's knowledge base.
 * Required: ALL reviewed pages must NOT return noindex.
 */

import type { CheckResult, FetchedPage } from "~/lib/aiLegibility/types";

const NOINDEX_PATTERNS = [/\bnoindex\b/i, /\bnone\b/i];

function hasNoindexInHtml(html: string): boolean {
  const metaMatch = html.match(
    /<meta\s+name\s*=\s*["']robots["'][^>]*content\s*=\s*["']([^"']*)["']/i,
  );
  if (!metaMatch) return false;
  return NOINDEX_PATTERNS.some((p) => p.test(metaMatch[1]));
}

function hasNoindexInHeader(xRobotsTag: string | null): boolean {
  if (!xRobotsTag) return false;
  return NOINDEX_PATTERNS.some((p) => p.test(xRobotsTag));
}

export default async function checkRobotsDirectives({
  pages,
}: {
  pages: FetchedPage[];
}): Promise<Omit<CheckResult, "category">> {
  const homepage = pages[0];

  const homepageMetaTag = hasNoindexInHtml(homepage.html);
  const homepageXRobotsTag = hasNoindexInHeader(
    homepage.headers["X-Robots-Tag"] ?? homepage.headers["x-robots-tag"] ?? null,
  );

  const noindexPages: { url: string; metaTag: boolean; xRobotsTag: boolean }[] = [];
  if (homepageMetaTag || homepageXRobotsTag)
    noindexPages.push({
      url: homepage.url,
      metaTag: homepageMetaTag,
      xRobotsTag: homepageXRobotsTag,
    });

  for (const page of pages) {
    const metaTag = hasNoindexInHtml(page.html);
    const xRobotsTag = hasNoindexInHeader(
      page.headers["X-Robots-Tag"] ?? page.headers["x-robots-tag"] ?? null,
    );
    if (metaTag || xRobotsTag)
      noindexPages.push({ url: page.url, metaTag, xRobotsTag });
  }

  if (noindexPages.length === 0) {
    const sampleCount = pages.length;
    return {
      name: "Robots directives",
      passed: true,
      message: `No noindex directives found on any of ${sampleCount} reviewed page${sampleCount === 1 ? "" : "s"}`,
      details: {
        homepageMetaTag,
        homepageXRobotsTag,
        pagesChecked: pages.length,
      },
    };
  }

  const parts = noindexPages.map((p) => {
    const sources: string[] = [];
    if (p.metaTag) sources.push("meta robots");
    if (p.xRobotsTag) sources.push("X-Robots-Tag");
    return `${p.url}: ${sources.join(" + ")}`;
  });

  return {
    name: "Robots directives",
    passed: false,
    message: `noindex found on ${noindexPages.length} page${noindexPages.length === 1 ? "" : "s"}: ${parts.join("; ")}`,
    details: {
      homepageMetaTag,
      homepageXRobotsTag,
      noindexPages,
      pagesChecked: pages.length,
    },
  };
}
