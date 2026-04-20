import type { CheckResult } from "../types";

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
  log,
}: {
  sampleURLs: string[];
  url: string;
  log: (line: string) => Promise<void>;
}): Promise<CheckResult & { pages: PageResult[] }> {
  await log("Checking sample pages...");

  const startTime = Date.now();
  const TOTAL_TIMEOUT = 120_000;
  const PAGE_TIMEOUT = 10_000;

  const pagesToCheck = sampleURLs.filter((u) => u !== url);

  if (pagesToCheck.length === 0) {
    const message = "No sample URLs found in sitemap";
    await log(`✗ ${message}`);
    return {
      name: "Sample pages",
      category: "important",
      passed: false,
      message,
      details: { sitemapUrlCount: sampleURLs.length },
      pages: [],
    };
  }

  const results: PageResult[] = [];

  for (const pageUrl of pagesToCheck) {
    const totalElapsed = Date.now() - startTime;
    if (totalElapsed >= TOTAL_TIMEOUT) {
      const message = "Skipped (total timeout exceeded)";
      await log(`✗ ${message}`);
      results.push({
        url: pageUrl,
        passed: false,
        message,
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
        const message = `HTTP ${response.status}`;
        await log(`✗ ${message}`);
        results.push({
          url: pageUrl,
          passed: false,
          message,
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
        const message = `Empty SPA shell (${contentLength} chars)`;
        await log(`✗ ${message}`);
        results.push({
          url: pageUrl,
          passed: false,
          message,
          timedOut: false,
          contentLength,
        });
        continue;
      }

      if (!hasRealContent) {
        const message = `Minimal content (${contentLength} chars)`;
        await log(`✗ ${message}`);
        results.push({
          url: pageUrl,
          passed: false,
          message,
          timedOut: false,
          contentLength,
        });
        continue;
      }

      const message = `${contentLength.toLocaleString()} chars`;
      await log(`✓ ${message}`);
      results.push({
        url: pageUrl,
        passed: true,
        message,
        timedOut: false,
        contentLength,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        const message = "Timed out (10s limit)";
        await log(`✗ ${message}`);
        results.push({
          url: pageUrl,
          passed: false,
          message,
          timedOut: true,
          contentLength: 0,
        });
      } else {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        await log(`✗ ${message}`);
        results.push({
          url: pageUrl,
          passed: false,
          message,
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
    const message = `All ${totalCount} sample pages have content`;
    await log(`✓ ${message}`);
    return {
      name: "Sample pages",
      category: "important",
      passed: true,
      message,
      details: { passedCount, totalCount, timedOutCount, elapsed },
      pages: results,
    };
  }

  const message = `${passedCount}/${totalCount} pages have content${timedOutCount > 0 ? ` (${timedOutCount} timed out)` : ""}`;
  await log(`✗ ${message}`);
  return {
    name: "Sample pages",
    category: "important",
    passed: false,
    message,
    details: { passedCount, totalCount, timedOutCount, elapsed },
    pages: results,
  };
}
