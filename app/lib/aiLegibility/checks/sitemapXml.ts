import { XMLParser } from "fast-xml-parser";
import type { CheckResult } from "~/lib/aiLegibility/types";

const parser = new XMLParser({ ignoreAttributes: false });

export default async function checkSitemapXml({
  url,
}: {
  url: string;
}): Promise<Omit<CheckResult, "category"> & { urls: string[] }> {
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
    const elapsed = Date.now() - startTime;

    try {
      const parsed = parser.parse(xml) as {
        sitemapindex?: {
          sitemap: { loc: string } | { loc: string }[];
        };
        urlset?: {
          url: { loc?: string } | { loc?: string }[];
        };
      };

      if (parsed.sitemapindex) {
        const sitemapNodes = Array.isArray(parsed.sitemapindex.sitemap)
          ? parsed.sitemapindex.sitemap
          : [parsed.sitemapindex.sitemap];
        const childUrls = sitemapNodes
          .map((s) => s.loc)
          .filter(Boolean) as string[];

        if (childUrls.length === 0) {
          return {
            name: "sitemap.xml",
            passed: true,
            message: "sitemap.xml is a sitemap index with no child sitemaps",
            details: { url: sitemapUrl, elapsed, mimeType: contentType },
            urls: [],
          };
        }

        const allUrls: string[] = [];
        const sitemapIndexElapsed = Date.now() - startTime;

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
              urlset?: {
                url: { loc?: string } | { loc?: string }[];
              };
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
    } catch (parseError) {
      return {
        name: "sitemap.xml",
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
