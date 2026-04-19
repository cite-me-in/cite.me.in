import type { CheckResult } from "../types";

export default async function checkSitemapTxt({
  url,
  log,
}: {
  url: string;
  log: (line: string) => Promise<void>;
}): Promise<CheckResult & { urls: string[] }> {
  await log("Checking sitemap.txt...");
  const sitemapUrl = new URL("/sitemap.txt", url).href;
  const startTime = Date.now();

  try {
    const response = await fetch(sitemapUrl, {
      headers: {
        "User-Agent": "CiteMeIn-AI-Legibility-Bot/1.0",
        Accept: "text/plain",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const message = `sitemap.txt not found (HTTP ${response.status})`;
      await log(`✗ ${message}`);
      return {
        name: "sitemap.txt",
        category: "critical",
        passed: false,
        message,
        details: { statusCode: response.status, url: sitemapUrl },
        urls: [],
      };
    }

    const content = await response.text();
    const lines = content.split("\n").filter((line) => line.trim());
    const urls: string[] = [];
    const invalidLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        new URL(trimmed);
        urls.push(trimmed);
      } catch {
        invalidLines.push(trimmed);
      }
    }

    const elapsed = Date.now() - startTime;

    if (urls.length === 0) {
      const message = "sitemap.txt exists but contains no valid URLs";
      await log(`✗ ${message}`);
      return {
        name: "sitemap.txt",
        category: "critical",
        passed: false,
        message,
        details: {
          url: sitemapUrl,
          lineCount: lines.length,
          invalidLines: invalidLines.slice(0, 5),
        },
        urls: [],
      };
    }

    if (invalidLines.length > 0) {
      const message = `sitemap.txt has ${urls.length} URLs (${invalidLines.length} invalid lines)`;
      await log(`✗ ${message}`);
      return {
        name: "sitemap.txt",
        category: "critical",
        passed: true,
        message,
        details: {
          url: sitemapUrl,
          validUrls: urls.length,
          invalidLines: invalidLines.length,
          elapsed,
        },
        urls,
      };
    }

    const message = `sitemap.txt has ${urls.length} valid URLs`;
    await log(`✓ ${message}`);
    return {
      name: "sitemap.txt",
      category: "critical",
      passed: true,
      message,
      details: { url: sitemapUrl, validUrls: urls.length, elapsed },
      urls,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    if (error instanceof Error && error.name === "TimeoutError") {
      const message = "sitemap.txt request timed out (10s limit)";
      await log(`✗ ${message}`);
      return {
        name: "sitemap.txt",
        category: "critical",
        passed: false,
        message,
        timedOut: true,
        details: { url: sitemapUrl },
        urls: [],
      };
    }
    const message = `Failed to fetch sitemap.txt: ${errorMessage}`;
    await log(`✗ ${message}`);
    return {
      name: "sitemap.txt",
      category: "critical",
      passed: false,
      message,
      details: { url: sitemapUrl, error: errorMessage },
      urls: [],
    };
  }
}
