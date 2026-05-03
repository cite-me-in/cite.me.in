/**
 * Spec: HTML spec — <link rel="alternate" type="text/markdown">
 * / RFC 8288 — Link: <>; rel="alternate"; type="text/markdown"
 * Advertises a Markdown version of the page for AI agents that can
 * request text/markdown content.
 * Required: at least one reviewed page must advertise a Markdown alternate
 * via Link header or HTML <link> tag.
 */

import { parseHTML } from "linkedom";
import type { CheckResult } from "~/lib/aiLegibility/types";

export default async function checkMarkdownAlternateLinks({
  pages,
}: {
  pages: {
    headers?: Headers;
    html: string;
    url: string;
  }[];
}): Promise<Omit<CheckResult, "category">> {
  const pageResults = pages.map((page) => {
    const linkHeader = page.headers?.get("Link") ?? null;
    const headerURLs = extractMarkdownUrlsFromHeader(linkHeader);
    const htmlURLs = extractMarkdownUrlsFromHtml(page.html);
    return {
      url: page.url,
      header: headerURLs.length > 0,
      htmlTag: htmlURLs.length > 0,
      headerUrls: headerURLs,
      htmlUrls: htmlURLs,
    };
  });

  const pagesChecked = pages.length;
  const pagesWithLink = pageResults.filter(
    (result) => result.header || result.htmlTag,
  ).length;

  const alternateURLs: string[] = [];
  for (const result of pageResults)
    if (result.header || result.htmlTag)
      for (const h of [...result.headerUrls, ...result.htmlUrls])
        alternateURLs.push(resolveURL(result.url, h));

  let message: string;
  if (pagesWithLink === 0) {
    message =
      "No <link rel='alternate' type='text/markdown'> found on any reviewed page";
  } else {
    const parts: string[] = pageResults
      .filter((result) => result.header || result.htmlTag)
      .map((result) => {
        const sources: string[] = [];
        if (result.header) sources.push("Link header");
        if (result.htmlTag) sources.push("HTML <link> tag");
        return `${result.url}: ${sources.join(" + ")}`;
      });
    message = `Markdown alternate version advertised: ${pagesWithLink}/${pagesChecked} pages; ${parts.join("; ")}`;
  }

  return {
    name: "Markdown alternate links",
    passed: pagesWithLink > 0,
    message,
    details: {
      pagesChecked,
      pagesWithLink,
      alternateUrls: alternateURLs,
    },
  };
}

function extractMarkdownUrlsFromHeader(linkHeader: string | null): string[] {
  if (!linkHeader) return [];
  const linkRegex = /<([^>]+)>\s*;\s*(.*?)(?=,\s*<|$)/g;
  return Array.from(linkHeader.matchAll(linkRegex))
    .filter(
      (match) =>
        /rel\s*=\s*"alternate"/i.test(match[2]) &&
        /type\s*=\s*"text\/markdown"/i.test(match[2]),
    )
    .map((match) => match[1]);
}

function extractMarkdownUrlsFromHtml(html: string): string[] {
  const { document } = parseHTML(html);
  const links = [
    ...document.querySelectorAll('link[rel="alternate"][type="text/markdown"]'),
  ] as HTMLLinkElement[];

  return links
    .map((link) => {
      const href = link.getAttribute("href");
      return href ? resolveURL(link.baseURI, href) : null;
    })
    .filter((url) => url !== null) as string[];
}

function resolveURL(base: string, href: string): string {
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  try {
    return new URL(href, base).href;
  } catch {
    return href;
  }
}
