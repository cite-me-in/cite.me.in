import { XMLParser } from "fast-xml-parser";
import type { CheckResult } from "../types";

const parser = new XMLParser({ ignoreAttributes: false });

export default async function checkSitemapXml({
  url,
}: {
  url: string;
}): Promise<CheckResult & { urls: string[] }> {
  const sitemapUrl = new URL("/sitemap.xml", url).href;
  const startTime = Date.now();

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
        category: "critical",
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
        category: "critical",
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
    const elapsed = Date.now() - startTime;

    try {
      const parsed = parser.parse(xml);
      const urlset = parsed.urlset ?? parsed;
      const urlNodes = Array.isArray(urlset.url)
        ? urlset.url
        : urlset.url
          ? [urlset.url]
          : [];
      const urls = urlNodes
        .map((node: { loc?: string }) => node.loc)
        .filter(Boolean);

      if (urls.length === 0) {
        return {
          name: "sitemap.xml",
          category: "critical",
          passed: true,
          message: "sitemap.xml is valid but contains no URLs",
          details: { url: sitemapUrl, elapsed, mimeType: contentType },
          urls: [],
        };
      }

      return {
        name: "sitemap.xml",
        category: "critical",
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
    } catch (parseError) {
      return {
        name: "sitemap.xml",
        category: "critical",
        passed: false,
        message: `sitemap.xml failed to parse: ${parseError instanceof Error ? parseError.message : "Unknown error"}`,
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
        category: "critical",
        passed: false,
        message: "sitemap.xml request timed out (10s limit)",
        timedOut: true,
        details: { url: sitemapUrl },
        urls: [],
      };
    }
    return {
      name: "sitemap.xml",
      category: "critical",
      passed: false,
      message: `Failed to fetch sitemap.xml: ${errorMessage}`,
      details: { url: sitemapUrl, error: errorMessage },
      urls: [],
    };
  }
}
