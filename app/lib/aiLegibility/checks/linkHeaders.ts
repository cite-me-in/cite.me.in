/**
 * Spec: RFC 8288 (Web Linking)
 * Sitemaps should be advertised via Link: </sitemap.xml>; rel="sitemap"
 * or HTML <link rel="sitemap" href="/sitemap.xml"> for AI agent discovery.
 */

import { parseHTML } from "linkedom";
import type { CheckResult } from "~/lib/aiLegibility/types";

export default async function checkLinkHeaders({
  html,
  links,
}: {
  html: string;
  links?: Headers | Record<string, string> | null;
}): Promise<Omit<CheckResult, "category">> {
  const startTime = Date.now();

  try {
    const linkHeader =
      links instanceof Headers
        ? links.get("Link") ?? links.get("link") ?? null
        : links?.Link ?? links?.link ?? null;
    const { document } = parseHTML(html);
    const htmlSitemapHref =
      document.querySelector('link[rel="sitemap"]')?.getAttribute("href") ??
      null;

    const headerSitemapLinks: { uri: string }[] = [];

    if (linkHeader) {
      const linkRegex = /<([^>]+)>\s*;\s*(.*?)(?=,\s*<|$)/g;
      let match;
      while ((match = linkRegex.exec(linkHeader)) !== null) {
        const uri = match[1];
        const paramsStr = match[2];
        const params: Record<string, string> = {};
        const paramRegex = /(\w+)\s*=\s*"([^"]*)"/g;
        let pm;
        while ((pm = paramRegex.exec(paramsStr)) !== null)
          params[pm[1]] = pm[2];
        if (params["rel"] === "sitemap") headerSitemapLinks.push({ uri });
      }
    }

    if (headerSitemapLinks.length > 0 || htmlSitemapHref) {
      const sources: string[] = [];
      if (headerSitemapLinks.length > 0)
        sources.push(
          `HTTP header (${headerSitemapLinks.map((l) => l.uri).join(", ")})`,
        );
      if (htmlSitemapHref) sources.push(`HTML <link> tag (${htmlSitemapHref})`);
      return {
        name: "Sitemap link headers",
        passed: true,
        message: `Sitemap referenced via ${sources.join(" and ")}`,
        details: {
          headerSitemapLinks,
          htmlSitemapHref,
        },
      };
    }

    const hasOtherLinks = linkHeader ? /<[^>]+>/g.test(linkHeader) : false;

    return {
      name: "Sitemap link headers",
      passed: false,
      message: hasOtherLinks
        ? "HTTP Link header exists but no rel='sitemap' reference found"
        : "No sitemap reference found in HTTP Link header or HTML <link rel='sitemap'> tag",
      details: {
        linkHeader,
        htmlSitemapHref: htmlSitemapHref || null,
        headerSitemapLinks,
      },
    };
  } catch (error) {
    const elapsed = Date.now() - startTime;
    if (error instanceof Error && error.name === "TimeoutError") {
      return {
        name: "Sitemap link headers",
        passed: false,
        message: "Sitemap link header check timed out (10s limit)",
        timedOut: true,
        details: { elapsed },
      };
    }
    return {
      name: "Sitemap link headers",
      passed: false,
      message: `Failed to check sitemap link headers: ${error instanceof Error ? error.message : "Unknown error"}`,
      details: { elapsed },
    };
  }
}
