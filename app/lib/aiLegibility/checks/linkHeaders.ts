import type { CheckResult } from "~/lib/aiLegibility/types";

export default async function checkLinkHeaders({
  url,
  html,
}: {
  url: string;
  html: string;
}): Promise<CheckResult> {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      headers: {
        "User-Agent": "CiteMeIn-AI-Legibility-Bot/1.0",
      },
      signal: AbortSignal.timeout(10_000),
    });

    const linkHeader = response.headers.get("Link");
    const hasSitemapLink = linkHeader?.toLowerCase().includes("sitemap");

    const htmlLinkMatch = html.match(
      /<link[^>]+rel\s*=\s*["']sitemap["'][^>]*>/i,
    );
    const hasHtmlSitemapLink = !!htmlLinkMatch;

    if (hasSitemapLink || hasHtmlSitemapLink) {
      const sources: string[] = [];
      if (hasSitemapLink) sources.push("HTTP header");
      if (hasHtmlSitemapLink) sources.push("HTML <link> tag");
      return {
        name: "Link headers",
        category: "discovered",
        passed: true,
        message: `Sitemap referenced via ${sources.join(" and ")}`,
        details: { linkHeader, htmlSitemapLink: hasHtmlSitemapLink },
      };
    }

    return {
      name: "Link headers",
      category: "discovered",
      passed: false,
      message:
        "No sitemap reference found in Link header or HTML <link rel='sitemap'> tag",
      details: { linkHeader, htmlSitemapLink: hasHtmlSitemapLink },
    };
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return {
        name: "Link headers",
        category: "discovered",
        passed: false,
        message: "Link headers check timed out (10s limit)",
        timedOut: true,
      };
    }
    return {
      name: "Link headers",
      category: "discovered",
      passed: false,
      message: `Failed to check Link headers: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
