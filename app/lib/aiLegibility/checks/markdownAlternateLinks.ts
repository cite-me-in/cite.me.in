import type { CheckResult } from "~/lib/aiLegibility/types";

export default async function checkMarkdownAlternateLinks({
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
    const hasMarkdownLink = linkHeader?.toLowerCase().includes("text/markdown");

    const htmlLinkMatch = html.match(
      /<link[^>]+rel\s*=\s*["']alternate["'][^>]+type\s*=\s*["']text\/markdown["'][^>]*>/i,
    );
    const hasHtmlMarkdownLink = !!htmlLinkMatch;

    if (hasMarkdownLink || hasHtmlMarkdownLink) {
      const sources: string[] = [];
      if (hasMarkdownLink) sources.push("HTTP header");
      if (hasHtmlMarkdownLink) sources.push("HTML <link> tag");
      return {
        name: "Markdown alternate links",
        category: "discovered",
        passed: true,
        message: `Markdown alternate version advertised via ${sources.join(" and ")}`,
        details: { linkHeader, htmlMarkdownLink: hasHtmlMarkdownLink },
      };
    }

    return {
      name: "Markdown alternate links",
      category: "discovered",
      passed: false,
      message:
        "No <link rel='alternate' type='text/markdown'> found in HTML or HTTP Link header",
      details: { linkHeader, htmlMarkdownLink: hasHtmlMarkdownLink },
    };
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError")
      return {
        name: "Markdown alternate links",
        category: "discovered",
        passed: false,
        message: "Markdown alternate links check timed out (10s limit)",
        timedOut: true,
      };
    return {
      name: "Markdown alternate links",
      category: "discovered",
      passed: false,
      message: `Failed to check markdown alternate links: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
