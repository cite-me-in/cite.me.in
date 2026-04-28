import type { CheckResult } from "~/lib/aiLegibility/types";

export default async function checkSitemapTxt({
  url,
}: {
  url: string;
}): Promise<CheckResult & { urls: string[] }> {
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
      return {
        name: "sitemap.txt",
        category: "discovered",
        passed: false,
        message: `sitemap.txt not found (HTTP ${response.status})`,
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
      return {
        name: "sitemap.txt",
        category: "discovered",
        passed: false,
        message: "sitemap.txt exists but contains no valid URLs",
        details: {
          url: sitemapUrl,
          lineCount: lines.length,
          invalidLines: invalidLines.slice(0, 5),
        },
        urls: [],
      };
    }

    if (invalidLines.length > 0) {
      return {
        name: "sitemap.txt",
        category: "discovered",
        passed: true,
        message: `sitemap.txt has ${urls.length} URLs (${invalidLines.length} invalid lines)`,
        details: {
          url: sitemapUrl,
          validUrls: urls.length,
          invalidLines: invalidLines.length,
          elapsed,
        },
        urls,
      };
    }

    return {
      name: "sitemap.txt",
      category: "discovered",
      passed: true,
      message: `sitemap.txt has ${urls.length} valid URLs`,
      details: { url: sitemapUrl, validUrls: urls.length, elapsed },
      urls,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    if (error instanceof Error && error.name === "TimeoutError") {
      return {
        name: "sitemap.txt",
        category: "discovered",
        passed: false,
        message: "sitemap.txt request timed out (10s limit)",
        timedOut: true,
        details: { url: sitemapUrl },
        urls: [],
      };
    }

    return {
      name: "sitemap.txt",
      category: "discovered",
      passed: false,
      message: `Failed to fetch sitemap.txt: ${errorMessage}`,
      details: { url: sitemapUrl, error: errorMessage },
      urls: [],
    };
  }
}
