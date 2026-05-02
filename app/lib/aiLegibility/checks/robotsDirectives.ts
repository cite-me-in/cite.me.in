/**
 * Spec: robots meta tag (HTML spec) + X-Robots-Tag header (Google)
 * Pages can prevent indexing via:
 *   <meta name="robots" content="noindex, nofollow">
 *   X-Robots-Tag: noindex
 * AI agents respect these directives — noindex means the page won't appear
 * in the agent's knowledge base.
 * Required: homepage and sample pages must NOT return noindex.
 */

import type { CheckResult } from "~/lib/aiLegibility/types";

const NOINDEX_PATTERNS = [/\bnoindex\b/i, /\bnone\b/i];

function hasNoindexInHtml(html: string): boolean {
  const metaMatch = html.match(
    /<meta\s+name\s*=\s*["']robots["'][^>]*content\s*=\s*["']([^"']*)["']/i,
  );
  if (!metaMatch) return false;
  return NOINDEX_PATTERNS.some((p) => p.test(metaMatch[1]));
}

function hasNoindexInHeader(linkHeader: string | null): boolean {
  if (!linkHeader) return false;
  return NOINDEX_PATTERNS.some((p) => p.test(linkHeader));
}

type PageNoindexResult = {
  url: string;
  passed: boolean;
  metaTag: boolean;
  xRobotsTag: boolean;
};

async function checkPageNoindex({
  url,
  html,
  xRobotsTag,
}: {
  url: string;
  html: string;
  xRobotsTag?: string | null;
}): Promise<PageNoindexResult> {
  let xRobotsTagValue = xRobotsTag ?? null;
  if (xRobotsTagValue === null) {
    try {
      const response = await fetch(url, {
        method: "HEAD",
        headers: { "User-Agent": "CiteMeIn-AI-Legibility-Bot/1.0" },
        signal: AbortSignal.timeout(10_000),
      });
      xRobotsTagValue = response.headers.get("X-Robots-Tag");
    } catch {
      // fetch failed; rely on HTML check only
    }
  }

  const metaTag = hasNoindexInHtml(html);
  const headerHasNoindex = hasNoindexInHeader(xRobotsTagValue);
  const noindexFound = metaTag || headerHasNoindex;

  return {
    url,
    passed: !noindexFound,
    metaTag,
    xRobotsTag: headerHasNoindex,
  };
}

export default async function checkRobotsDirectives({
  url,
  html,
  pages,
  homepageXRobotsTag,
  pageXRobotsTags,
}: {
  url: string;
  html: string;
  pages?: { url: string; html?: string }[];
  homepageXRobotsTag?: string | null;
  pageXRobotsTags?: Record<string, string | null | undefined>;
}): Promise<Omit<CheckResult, "category">> {
  const homepageResult = await checkPageNoindex({
    url,
    html,
    xRobotsTag: homepageXRobotsTag,
  });

  const pageResults: PageNoindexResult[] = [];
  if (pages) {
    for (const page of pages) {
      if (!page.html) {
        pageResults.push({
          url: page.url,
          passed: true,
          metaTag: false,
          xRobotsTag: false,
        });
        continue;
      }
      const result = await checkPageNoindex({
        url: page.url,
        html: page.html,
        xRobotsTag: pageXRobotsTags?.[page.url],
      });
      pageResults.push(result);
    }
  }

  const noindexPages = [homepageResult, ...pageResults].filter(
    (r) => !r.passed,
  );

  if (noindexPages.length === 0) {
    return {
      name: "Robots directives",
      passed: true,
      message: `No noindex directives found on homepage${pages ? ` or ${pages.length} sample pages` : ""}`,
      details: {
        homepageMetaTag: homepageResult.metaTag,
        homepageXRobotsTag: homepageResult.xRobotsTag,
        pagesChecked: pages?.length ?? 0,
      },
    };
  }

  const parts = noindexPages.map((p) => {
    const sources: string[] = [];
    if (p.metaTag) sources.push("meta robots");
    if (p.xRobotsTag) sources.push("X-Robots-Tag");
    return `${p.url === url ? "Homepage" : p.url}: ${sources.join(" + ")}`;
  });

  return {
    name: "Robots directives",
    passed: false,
    message: `noindex found on ${noindexPages.length} page${noindexPages.length === 1 ? "" : "s"}: ${parts.join("; ")}`,
    details: {
      homepageMetaTag: homepageResult.metaTag,
      homepageXRobotsTag: homepageResult.xRobotsTag,
      noindexPages,
      pagesChecked: pages?.length ?? 0,
    },
  };
}
