import { XMLParser } from "fast-xml-parser";
import type { CheckResult } from "../types";

const parser = new XMLParser({ ignoreAttributes: false });

export default async function checkSitemapXml({
  log,
  url,
}: {
  log: (line: string) => Promise<void>;
  url: string;
}): Promise<CheckResult & { urls: string[] }> {
  await log("Checking sitemap.xml...");

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
      const message = `sitemap.xml not found (HTTP ${response.status})`;
      await log(`✗ ${message}`);
      return {
        name: "sitemap.xml",
        category: "critical",
        passed: false,
        message,
        details: { statusCode: response.status, url: sitemapUrl },
        urls: [],
      };
    }

    const contentType = response.headers.get("content-type") ?? "";
    const isTextXml = contentType.includes("text/xml");
    const isAppXml = contentType.includes("application/xml");
    const isReadable = isTextXml || isAppXml;

    if (!isReadable) {
      const message = `sitemap.xml has incorrect MIME type: ${contentType}`;
      await log(`✗ ${message}`);
      return {
        name: "sitemap.xml",
        category: "critical",
        passed: false,
        message,
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
        const message = "sitemap.xml is valid but contains no URLs";
        await log(`✗ ${message}`);
        return {
          name: "sitemap.xml",
          category: "critical",
          passed: true,
          message,
          details: { url: sitemapUrl, elapsed, mimeType: contentType },
          urls: [],
        };
      }

      const message = `sitemap.xml has ${urls.length} URLs (${contentType})`;
      await log(`✓ ${message}`);
      return {
        name: "sitemap.xml",
        category: "critical",
        passed: true,
        message,
        details: {
          url: sitemapUrl,
          validUrls: urls.length,
          elapsed,
          mimeType: contentType,
        },
        urls,
      };
    } catch (parseError) {
      const message = `sitemap.xml failed to parse: ${parseError instanceof Error ? parseError.message : "Unknown error"}`;
      await log(`✗ ${message}`);
      return {
        name: "sitemap.xml",
        category: "critical",
        passed: false,
        message,
        details: { url: sitemapUrl, elapsed, mimeType: contentType },
        urls: [],
      };
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    if (error instanceof Error && error.name === "TimeoutError") {
      const message = "sitemap.xml request timed out (10s limit)";
      await log(`✗ ${message}`);
      return {
        name: "sitemap.xml",
        category: "critical",
        passed: false,
        message,
        timedOut: true,
        details: { url: sitemapUrl },
        urls: [],
      };
    }
    const message = `Failed to fetch sitemap.xml: ${errorMessage}`;
    await log(`✗ ${message}`);
    return {
      name: "sitemap.xml",
      category: "critical",
      passed: false,
      message,
      details: { url: sitemapUrl, error: errorMessage },
      urls: [],
    };
  }
}
