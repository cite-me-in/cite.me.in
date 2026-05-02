/**
 * Spec: HTML spec — <link rel="alternate" type="text/markdown">
 * / RFC 8288 — Link: <>; rel="alternate"; type="text/markdown"
 * Advertises a Markdown version of the page for AI agents that can
 * request text/markdown content.
 * Required: at least one page (homepage or sample page) must advertise
 * a Markdown alternate via Link header or HTML <link> tag.
 */

import type { CheckResult } from "~/lib/aiLegibility/types";

function extractMarkdownUrlsFromHeader(linkHeader: string | null): string[] {
  if (!linkHeader) return [];
  const urls: string[] = [];
  const linkRegex = /<([^>]+)>\s*;\s*(.*?)(?=,\s*<|$)/g;
  let match;
  while ((match = linkRegex.exec(linkHeader)) !== null) {
    const paramsStr = match[2];
    const hasAlternate = /rel\s*=\s*"alternate"/i.test(paramsStr);
    const isMarkdown = /type\s*=\s*"text\/markdown"/i.test(paramsStr);
    if (hasAlternate && isMarkdown) {
      urls.push(match[1]);
    }
  }
  return urls;
}

function extractMarkdownUrlsFromHtml(html: string): string[] {
  const urls: string[] = [];
  const linkTagRegex = /<link\s[^>]*>/gi;
  let match;
  while ((match = linkTagRegex.exec(html)) !== null) {
    const tag = match[0];
    const hasAlternate = /\brel\s*=\s*["']alternate["']/i.test(tag);
    const isMarkdown = /type\s*=\s*["']text\/markdown["']/i.test(tag);
    const hrefMatch = /href\s*=\s*["']([^"']*)["']/i.exec(tag);
    if (hasAlternate && isMarkdown && hrefMatch) {
      urls.push(hrefMatch[1]);
    }
  }
  return urls;
}

function resolveUrl(base: string, href: string): string {
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  try {
    return new URL(href, base).href;
  } catch {
    return href;
  }
}

async function checkPage({
  url,
  html,
  linkHeader,
}: {
  url: string;
  html: string;
  linkHeader?: string | null;
}): Promise<{
  found: boolean;
  header: boolean;
  htmlTag: boolean;
  headerUrls: string[];
  htmlUrls: string[];
}> {
  let linkHeaderValue = linkHeader ?? null;
  if (linkHeaderValue === null) {
    try {
      const response = await fetch(url, {
        method: "HEAD",
        headers: {
          "User-Agent": "CiteMeIn-AI-Legibility-Bot/1.0",
        },
        signal: AbortSignal.timeout(10_000),
      });
      linkHeaderValue = response.headers.get("Link");
    } catch {
      // fall through to HTML-only check below
    }
  }
  const headerUrls = extractMarkdownUrlsFromHeader(linkHeaderValue);
  const htmlUrls = extractMarkdownUrlsFromHtml(html);
  return {
    found: headerUrls.length > 0 || htmlUrls.length > 0,
    header: headerUrls.length > 0,
    htmlTag: htmlUrls.length > 0,
    headerUrls,
    htmlUrls,
  };
}

export default async function checkMarkdownAlternateLinks({
  url,
  html,
  pages,
  homepageLinkHeader,
  pageLinkHeaders,
}: {
  url: string;
  html: string;
  pages?: { url: string; html?: string }[];
  homepageLinkHeader?: string | null;
  pageLinkHeaders?: Record<string, string | null | undefined>;
}): Promise<
  Omit<CheckResult, "category"> & {
    pagesChecked?: number;
    pagesWithLink?: number;
    alternateUrls?: string[];
  }
> {
  const homepageResult = await checkPage({
    url,
    html,
    linkHeader: homepageLinkHeader,
  });

  let sampleResults: {
    url: string;
    found: boolean;
    header: boolean;
    htmlTag: boolean;
    headerUrls: string[];
    htmlUrls: string[];
  }[] = [];

  if (pages) {
    for (const page of pages) {
      if (!page.html) {
        sampleResults.push({
          url: page.url,
          found: false,
          header: false,
          htmlTag: false,
          headerUrls: [],
          htmlUrls: [],
        });
        continue;
      }
      const result = await checkPage({
        url: page.url,
        html: page.html,
        linkHeader: pageLinkHeaders?.[page.url],
      });
      sampleResults.push({ url: page.url, ...result });
    }
  }

  const pagesChecked = pages?.length ?? 0;
  const pagesWithLink = sampleResults.filter((r) => r.found).length;
  const anyFound = homepageResult.found || pagesWithLink > 0;

  const alternateUrls: string[] = [];
  if (homepageResult.found) {
    for (const h of [
      ...homepageResult.headerUrls,
      ...homepageResult.htmlUrls,
    ]) {
      alternateUrls.push(resolveUrl(url, h));
    }
  }
  for (const sr of sampleResults) {
    if (sr.found) {
      for (const h of [...sr.headerUrls, ...sr.htmlUrls]) {
        alternateUrls.push(resolveUrl(sr.url, h));
      }
    }
  }

  const parts: string[] = [];
  if (homepageResult.found) {
    const sources: string[] = [];
    if (homepageResult.header) sources.push("Link header");
    if (homepageResult.htmlTag) sources.push("HTML <link> tag");
    parts.push(`Homepage: ${sources.join(" + ")}`);
  } else {
    parts.push("Homepage: not found");
  }

  if (pagesChecked > 0) {
    if (pagesWithLink === 0) {
      parts.push("Sample pages: none advertise markdown alternate");
    } else {
      parts.push(
        `Sample pages: ${pagesWithLink}/${pagesChecked} have markdown alternate links`,
      );
    }
  }

  return {
    name: "Markdown alternate links",
    passed: anyFound,
    message: anyFound
      ? `Markdown alternate version advertised: ${parts.join("; ")}`
      : "No <link rel='alternate' type='text/markdown'> found on homepage or sample pages",
    details: {
      homepageFound: homepageResult.found,
      homepageFromHeader: homepageResult.header,
      homepageFromHtml: homepageResult.htmlTag,
      pagesChecked,
      pagesWithLink,
      alternateUrls,
    },
  };
}
