/**
 * Spec: RFC 8288 (Web Linking)
 * Format: Link: <URI>; rel="relation-type"; param="value"
 * The rel parameter MUST be present. Extension relation types should use absolute URIs.
 * Sitemaps are discovered via rel="sitemap" links.
 */

import type { CheckResult } from "~/lib/aiLegibility/types";

export default async function checkLinkHeaders({
  url,
  html,
}: {
  url: string;
  html: string;
}): Promise<Omit<CheckResult, "category">> {
  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      method: "HEAD",
      headers: {
        "User-Agent": "CiteMeIn-AI-Legibility-Bot/1.0",
      },
      signal: AbortSignal.timeout(10_000),
    });

    const linkHeader = response.headers.get("Link");
    const htmlSitemapLink = html.match(
      /<link[^>]+rel\s*=\s*["']sitemap["'][^>]*href\s*=\s*["']([^"']*)["']/i,
    );

    const parsedLinks: {
      uri: string;
      rel: string;
      params: Record<string, string>;
    }[] = [];

    if (linkHeader) {
      const linkRegex = /<([^>]+)>\s*;\s*(.+?)(?=,\s*<|$)/g;
      let match;
      while ((match = linkRegex.exec(linkHeader)) !== null) {
        const uri = match[1];
        const paramsStr = match[2];
        const params: Record<string, string> = {};
        const paramRegex = /(\w+)\s*=\s*"([^"]*)"/g;
        let pm;
        while ((pm = paramRegex.exec(paramsStr)) !== null) {
          params[pm[1]] = pm[2];
        }
        parsedLinks.push({ uri, rel: params["rel"] || "", params });
      }
    }

    const headerSitemapLinks = parsedLinks.filter(
      (link) => link.rel === "sitemap",
    );

    if (headerSitemapLinks.length > 0 || htmlSitemapLink) {
      const sources: string[] = [];
      if (headerSitemapLinks.length > 0)
        sources.push(
          `HTTP header (${headerSitemapLinks.map((l) => l.uri).join(", ")})`,
        );
      if (htmlSitemapLink)
        sources.push(`HTML <link> tag (${htmlSitemapLink[1]})`);
      return {
        name: "Link headers",
        passed: true,
        message: `Sitemap referenced via ${sources.join(" and ")}`,
        details: {
          headerLinks: headerSitemapLinks,
          htmlSitemapHref: htmlSitemapLink?.[1],
          allParsedLinks: parsedLinks,
        },
      };
    }

    const headerIssues: string[] = [];
    if (linkHeader && parsedLinks.length === 0) {
      headerIssues.push("Link header present but could not parse any links");
    } else if (parsedLinks.length > 0 && headerSitemapLinks.length === 0) {
      const rels = parsedLinks.map((l) => l.rel).join(", ");
      headerIssues.push(`Link header found with rel="${rels}" but no sitemap`);
    }

    return {
      name: "Link headers",
      passed: false,
      message:
        headerIssues.length > 0
          ? headerIssues.join("; ")
          : "No sitemap reference found in Link header or HTML <link rel='sitemap'> tag",
      details: {
        linkHeader,
        htmlSitemapHref: htmlSitemapLink?.[1] || null,
        parsedLinks,
      },
    };
  } catch (error) {
    const elapsed = Date.now() - startTime;
    if (error instanceof Error && error.name === "TimeoutError") {
      return {
        name: "Link headers",
        passed: false,
        message: "Link headers check timed out (10s limit)",
        timedOut: true,
        details: { elapsed },
      };
    }
    return {
      name: "Link headers",
      passed: false,
      message: `Failed to check Link headers: ${error instanceof Error ? error.message : "Unknown error"}`,
      details: { elapsed },
    };
  }
}
