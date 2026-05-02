/**
 * Per the sitemaps.org protocol:
 *
 *   "You can specify the location of the Sitemap using a robots.txt file...
 *    Sitemap: http://www.example.com/sitemap.xml"
 *
 * The spec says robots.txt is the primary discovery mechanism. A sitemap can
 * be at *any* URL — /sitemap.xml is just a convention. This function:
 *
 * 1. Tries URLs specified via robots.txt Sitemap directives first
 * 2. Falls back to /sitemap.xml if no robot-provided URLs work
 * 3. Resolves sitemap indexes by fetching child sitemaps
 *
 * Each Sitemap file must be UTF-8, ≤50MB, ≤50K URLs. Sitemap index files
 * may list ≤50K child sitemaps and must be on the same host as the index.
 */

import { XMLParser } from "fast-xml-parser";
import type { CheckResult } from "~/lib/aiLegibility/types";

const parser = new XMLParser({ ignoreAttributes: false });

export default async function checkSitemapXml({
  url,
  robotsSitemapUrls,
}: {
  url: string;
  robotsSitemapUrls?: string[];
}): Promise<Omit<CheckResult, "category"> & { urls: string[] }> {
  const urlsToTry = robotsSitemapUrls ?? [new URL("/sitemap.xml", url).href];
  const startTime = Date.now();

  if (urlsToTry.length === 1) return fetchSitemapXml(urlsToTry[0], startTime);

  let lastError:
    | (Omit<CheckResult, "category"> & { urls: string[] })
    | undefined;

  for (const sitemapUrl of urlsToTry) {
    const result = await fetchSitemapXml(sitemapUrl, startTime);
    if (result.passed) return result;
    lastError = result;
  }

  return (
    lastError ?? {
      name: "sitemap.xml",
      passed: false,
      message: "No sitemap found at locations from robots.txt",
      details: { triedUrls: urlsToTry },
      urls: [],
    }
  );
}

async function fetchSitemapXml(
  sitemapUrl: string,
  baseElapsed: number,
): Promise<Omit<CheckResult, "category"> & { urls: string[] }> {
  try {
    const response = await fetch(sitemapUrl, {
      headers: {
        "User-Agent": "CiteMeIn-AI-Legibility-Bot/1.0",
        Accept: "application/xml,text/xml",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return {
        name: "sitemap.xml",
        passed: false,
        message: `sitemap.xml not found (HTTP ${response.status})`,
        details: { statusCode: response.status, url: sitemapUrl },
        urls: [],
      };
    }

    const contentType = response.headers.get("content-type") ?? "";
    const isTextXml = contentType.includes("text/xml");
    const isAppXml = contentType.includes("application/xml");
    const isReadable = isTextXml || isAppXml;

    if (!isReadable) {
      return {
        name: "sitemap.xml",
        passed: false,
        message: `sitemap.xml has incorrect MIME type: ${contentType}`,
        details: {
          contentType,
          url: sitemapUrl,
          expected: "text/xml or application/xml",
        },
        urls: [],
      };
    }

    const xml = await response.text();
    const elapsed = Date.now() - baseElapsed;

    try {
      const parsed = parser.parse(xml) as {
        sitemapindex?: { sitemap: { loc: string } | { loc: string }[] };
        urlset?: { url: { loc?: string } | { loc?: string }[] };
      };

      if (parsed.sitemapindex) {
        return handleSitemapIndex(
          parsed.sitemapindex,
          sitemapUrl,
          baseElapsed,
          contentType,
        );
      }

      const urlset = parsed.urlset;
      if (!urlset) {
        return {
          name: "sitemap.xml",
          passed: true,
          message: "sitemap.xml is valid but contains no URLs",
          details: { url: sitemapUrl, elapsed, mimeType: contentType },
          urls: [],
        };
      }

      const urlNodes = Array.isArray(urlset.url)
        ? urlset.url
        : urlset.url
          ? [urlset.url]
          : [];
      const urls = urlNodes.map(({ loc }) => loc).filter(Boolean) as string[];

      if (urls.length === 0) {
        return {
          name: "sitemap.xml",
          passed: true,
          message: "sitemap.xml is valid but contains no URLs",
          details: { url: sitemapUrl, elapsed, mimeType: contentType },
          urls: [],
        };
      }

      return {
        name: "sitemap.xml",
        passed: true,
        message: `sitemap.xml has ${urls.length} URLs (${contentType})`,
        details: {
          url: sitemapUrl,
          validUrls: urls.length,
          elapsed,
          mimeType: contentType,
        },
        urls,
      };
    } catch {
      return {
        name: "sitemap.xml",
        passed: false,
        message: "sitemap.xml failed to parse",
        details: { url: sitemapUrl, elapsed, mimeType: contentType },
        urls: [],
      };
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    if (error instanceof Error && error.name === "TimeoutError") {
      return {
        name: "sitemap.xml",
        passed: false,
        message: "sitemap.xml request timed out (10s limit)",
        timedOut: true,
        details: { url: sitemapUrl },
        urls: [],
      };
    }
    return {
      name: "sitemap.xml",
      passed: false,
      message: `Failed to fetch sitemap.xml: ${errorMessage}`,
      details: { url: sitemapUrl, error: errorMessage },
      urls: [],
    };
  }
}

async function handleSitemapIndex(
  sitemapindex: { sitemap: { loc: string } | { loc: string }[] },
  sitemapUrl: string,
  startTime: number,
  contentType: string,
): Promise<Omit<CheckResult, "category"> & { urls: string[] }> {
  const sitemapNodes = Array.isArray(sitemapindex.sitemap)
    ? sitemapindex.sitemap
    : [sitemapindex.sitemap];
  const childUrls = sitemapNodes.map((s) => s.loc).filter(Boolean) as string[];

  if (childUrls.length === 0) {
    return {
      name: "sitemap.xml",
      passed: true,
      message: "sitemap.xml is a sitemap index with no child sitemaps",
      details: {
        url: sitemapUrl,
        elapsed: Date.now() - startTime,
        mimeType: contentType,
      },
      urls: [],
    };
  }

  const allUrls: string[] = [];

  for (const childUrl of childUrls) {
    try {
      const childResponse = await fetch(childUrl, {
        headers: {
          "User-Agent": "CiteMeIn-AI-Legibility-Bot/1.0",
          Accept: "application/xml,text/xml",
        },
        signal: AbortSignal.timeout(10_000),
      });

      if (!childResponse.ok) continue;

      const childXml = await childResponse.text();
      const childParsed = parser.parse(childXml) as {
        urlset?: { url: { loc?: string } | { loc?: string }[] };
      };

      if (childParsed.urlset) {
        const childUrlNodes = Array.isArray(childParsed.urlset.url)
          ? childParsed.urlset.url
          : [childParsed.urlset.url];
        const childPageUrls = childUrlNodes
          .map((u) => u.loc)
          .filter(Boolean) as string[];
        allUrls.push(...childPageUrls);
      }
    } catch {
      continue;
    }
  }

  const sitemapIndexElapsed = Date.now() - startTime;

  if (allUrls.length === 0) {
    return {
      name: "sitemap.xml",
      passed: true,
      message:
        "sitemap.xml is a sitemap index but no child sitemaps resolved to URLs",
      details: {
        url: sitemapUrl,
        childSitemaps: childUrls.length,
        elapsed: sitemapIndexElapsed,
        mimeType: contentType,
      },
      urls: [],
    };
  }

  return {
    name: "sitemap.xml",
    passed: true,
    message: `sitemap.xml is a sitemap index with ${childUrls.length} child sitemaps, ${allUrls.length} total URLs`,
    details: {
      url: sitemapUrl,
      childSitemaps: childUrls.length,
      validUrls: allUrls.length,
      elapsed: sitemapIndexElapsed,
      mimeType: contentType,
    },
    urls: allUrls,
  };
}
