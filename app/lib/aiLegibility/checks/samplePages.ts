import type { CheckResult } from "~/lib/aiLegibility/types";

const MIN_CONTENT_LENGTH = 100;
const SPA_PATTERNS = [
  /<div\s+id\s*=\s*["']root["']/i,
  /<div\s+id\s*=\s*["']app["']/i,
];

type PageResult = {
  url: string;
  passed: boolean;
  message: string;
  timedOut: boolean;
  contentLength: number;
};

export default async function checkSamplePages({
  sampleURLs,
  url,
}: {
  sampleURLs: string[];
  url: string;
}): Promise<CheckResult & { pages: PageResult[] }> {
  const startTime = Date.now();
  const TOTAL_TIMEOUT = 120_000;
  const PAGE_TIMEOUT = 10_000;

  const pagesToCheck = sampleURLs.filter((u) => u !== url);

  if (pagesToCheck.length === 0) {
    return {
      name: "Sample pages",
      category: "trusted",
      passed: false,
      message: "No sample URLs found in sitemap",
      details: { sitemapUrlCount: sampleURLs.length },
      pages: [],
    };
  }

  const results: PageResult[] = [];

  for (const pageUrl of pagesToCheck) {
    const totalElapsed = Date.now() - startTime;
    if (totalElapsed >= TOTAL_TIMEOUT) {
      results.push({
        url: pageUrl,
        passed: false,
        message: "Skipped (total timeout exceeded)",
        timedOut: true,
        contentLength: 0,
      });
      continue;
    }

    try {
      const response = await fetch(pageUrl, {
        headers: {
          "User-Agent": "CiteMeIn-AI-Legibility-Bot/1.0",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(
          Math.min(PAGE_TIMEOUT, TOTAL_TIMEOUT - totalElapsed),
        ),
      });

      const html = await response.text();

      if (!response.ok) {
        results.push({
          url: pageUrl,
          passed: false,
          message: `HTTP ${response.status}`,
          timedOut: false,
          contentLength: 0,
        });
        continue;
      }

      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      const bodyContent = bodyMatch?.[1] ?? html;
      const textContent = bodyContent.replace(/<[^>]+>/g, "").trim();
      const contentLength = textContent.length;

      const isSpaShell = SPA_PATTERNS.some((pattern) => pattern.test(html));
      const hasRealContent = contentLength >= MIN_CONTENT_LENGTH;

      if (isSpaShell && !hasRealContent) {
        results.push({
          url: pageUrl,
          passed: false,
          message: `Empty SPA shell (${contentLength} chars)`,
          timedOut: false,
          contentLength,
        });
        continue;
      }

      if (!hasRealContent) {
        results.push({
          url: pageUrl,
          passed: false,
          message: `Minimal content (${contentLength} chars)`,
          timedOut: false,
          contentLength,
        });
        continue;
      }

      results.push({
        url: pageUrl,
        passed: true,
        message: `${contentLength.toLocaleString()} chars`,
        timedOut: false,
        contentLength,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        results.push({
          url: pageUrl,
          passed: false,
          message: "Timed out (10s limit)",
          timedOut: true,
          contentLength: 0,
        });
      } else {
        results.push({
          url: pageUrl,
          passed: false,
          message: error instanceof Error ? error.message : "Unknown error",
          timedOut: false,
          contentLength: 0,
        });
      }
    }
  }

  const passedCount = results.filter((r) => r.passed).length;
  const timedOutCount = results.filter((r) => r.timedOut).length;
  const totalCount = results.length;
  const elapsed = Date.now() - startTime;

  if (passedCount === totalCount) {
    return {
      name: "Sample pages",
      category: "trusted",
      passed: true,
      message: `All ${totalCount} sample pages have content`,
      details: { passedCount, totalCount, timedOutCount, elapsed },
      pages: results,
    };
  }

  return {
    name: "Sample pages",
    category: "trusted",
    passed: false,
    message: `${passedCount}/${totalCount} pages have content${timedOutCount > 0 ? ` (${timedOutCount} timed out)` : ""}`,
    details: { passedCount, totalCount, timedOutCount, elapsed },
    pages: results,
  };
}
