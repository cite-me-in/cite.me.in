/**
 * Per the sitemaps.org protocol:
 *
 *   "You can specify the location of the Sitemap using a robots.txt file...
 *    Sitemap: http://www.example.com/sitemap.xml"
 *
 * The spec says robots.txt is the primary discovery mechanism. Text sitemaps
 * are also supported ("one URL per line"). This function:
 *
 * 1. Tries URLs specified via robots.txt Sitemap directives first
 * 2. Falls back to /sitemap.txt if no robot-provided URLs work
 */

import type { CheckResult } from "~/lib/aiLegibility/types";

export default async function checkSitemapTxt({
  url,
  robotsSitemapUrls,
}: {
  url: string;
  robotsSitemapUrls?: string[];
}): Promise<Omit<CheckResult, "category"> & { urls: string[] }> {
  const urlsToTry = robotsSitemapUrls ?? [new URL("/sitemap.txt", url).href];

  if (urlsToTry.length === 1) {
    return fetchSitemapTxt(urlsToTry[0]);
  }

  let lastError: (Omit<CheckResult, "category"> & { urls: string[] }) | undefined;

  for (const sitemapUrl of urlsToTry) {
    const result = await fetchSitemapTxt(sitemapUrl);
    if (result.passed) return result;
    lastError = result;
  }

  return (
    lastError ?? {
      name: "sitemap.txt",
      passed: false,
      message: "No sitemap found at locations from robots.txt",
      details: { triedUrls: urlsToTry },
      urls: [],
    }
  );
}

async function fetchSitemapTxt(
  sitemapUrl: string,
): Promise<Omit<CheckResult, "category"> & { urls: string[] }> {
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
        passed: false,
        message: `sitemap.txt not found (HTTP ${response.status})`,
        details: { statusCode: response.status, url: sitemapUrl },
        urls: [],
      };
    }

    const content = await response.text();
    const elapsed = Date.now() - startTime;

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

    if (urls.length === 0) {
      return {
        name: "sitemap.txt",
        passed: true,
        message: "sitemap.txt exists but no valid URLs found (AI agents will skip it)",
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
      passed: true,
      message: `sitemap.txt has ${urls.length} valid URLs`,
      details: { url: sitemapUrl, validUrls: urls.length, elapsed },
      urls,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    if (error instanceof Error && error.name === "TimeoutError") {
      return {
        name: "sitemap.txt",
        passed: false,
        message: "sitemap.txt request timed out (10s limit)",
        timedOut: true,
        details: { url: sitemapUrl },
        urls: [],
      };
    }
    return {
      name: "sitemap.txt",
      passed: false,
      message: `Failed to fetch sitemap.txt: ${errorMessage}`,
      details: { url: sitemapUrl, error: errorMessage },
      urls: [],
    };
  }
}
