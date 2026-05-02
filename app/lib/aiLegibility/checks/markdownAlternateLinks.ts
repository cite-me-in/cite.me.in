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
}): Promise<
  Omit<CheckResult, "category"> & {
    pagesChecked?: number;
    pagesWithLink?: number;
    alternateUrls?: string[];
  }
> {
  const pageResults = pages.map((page) => {
    const linkHeader =
      page.headers?.get("Link") ?? page.headers?.get("link") ?? null;
    const headerUrls = extractMarkdownUrlsFromHeader(linkHeader);
    const htmlUrls = extractMarkdownUrlsFromHtml(page.html);
    return {
      url: page.url,
      found: headerUrls.length > 0 || htmlUrls.length > 0,
      header: headerUrls.length > 0,
      htmlTag: htmlUrls.length > 0,
      headerUrls,
      htmlUrls,
    };
  });

  const pagesChecked = pages.length;
  const pagesWithLink = pageResults.filter((r) => r.found).length;

  const alternateURLs: string[] = [];
  for (const pr of pageResults)
    if (pr.found)
      for (const h of [...pr.headerUrls, ...pr.htmlUrls])
        alternateURLs.push(resolveURL(pr.url, h));

  let message: string;
  if (pagesWithLink === 0) {
    message =
      "No <link rel='alternate' type='text/markdown'> found on any reviewed page";
  } else {
    const parts: string[] = pageResults
      .filter((pr) => pr.found)
      .map((pr) => {
        const sources: string[] = [];
        if (pr.header) sources.push("Link header");
        if (pr.htmlTag) sources.push("HTML <link> tag");
        return `${pr.url}: ${sources.join(" + ")}`;
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
