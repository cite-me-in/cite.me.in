/**
 * Spec: HTML spec — semantic elements improve AI content extraction.
 * Heading hierarchy (h1→h6), descriptive link text, and semantic elements
 * like <main>, <nav>, <article> help AI agents understand page structure.
 * Required: at least one reviewed page should have a reasonable heading
 * hierarchy and some semantic elements. Fails if no page has any headings
 * or semantic structure.
 */

import { parseHTML } from "linkedom";
import type { CheckResult } from "~/lib/aiLegibility/types";

type PageResult = {
  url: string;
  passed: boolean;
  headings: { level: number; text: string }[];
  semanticTags: string[];
  linkTextIssues: number;
};

export default async function checkSemanticHtml({
  pages,
}: {
  pages: { url: string; html: string }[];
}): Promise<Omit<CheckResult, "category">> {
  const pageResults: PageResult[] = [];

  for (const page of pages) {
    const { document } = parseHTML(page.html);

    const headings: { level: number; text: string }[] = [];
    for (let i = 1; i <= 6; i++) {
      const elements = [...document.querySelectorAll(`h${i}`)] as HTMLElement[];
      for (const el of elements)
        headings.push({ level: i, text: (el.textContent ?? "").trim() });
    }

    const semanticTags: string[] = [];
    for (const tag of [
      "main",
      "nav",
      "article",
      "section",
      "header",
      "footer",
      "aside",
    ]) {
      const elements = document.querySelectorAll(tag);
      if (elements.length > 0) semanticTags.push(tag);
    }

    const links = [
      ...document.querySelectorAll("a[href]"),
    ] as HTMLLinkElement[];
    const linkTextIssues = links.filter((a) => {
      const text = (a.textContent ?? "").trim();
      return (
        !text ||
        text.length < 3 ||
        /^(click here|read more|this|link)$/i.test(text)
      );
    }).length;

    const hasGoodHierarchy = headings.length > 0 && headings[0]?.level === 1;
    const hasSemanticTags = semanticTags.length >= 2;

    pageResults.push({
      url: page.url,
      passed: hasGoodHierarchy || hasSemanticTags,
      headings,
      semanticTags,
      linkTextIssues,
    });
  }

  const pagesPassing = pageResults.filter((p) => p.passed).length;
  const totalPages = pageResults.length;
  const passed = pagesPassing > 0;

  const parts: string[] = [];
  if (totalPages > 0) {
    const withHeadings = pageResults.filter(
      (p) => p.headings.length > 0,
    ).length;
    const withSemantic = pageResults.filter(
      (p) => p.semanticTags.length > 0,
    ).length;
    if (withHeadings > 0)
      parts.push(`${withHeadings}/${totalPages} have heading structure`);
    if (withSemantic > 0)
      parts.push(`${withSemantic}/${totalPages} have semantic elements`);
    if (withHeadings === 0) parts.push("no headings found on any page");
  }

  return {
    name: "Semantic HTML",
    passed,
    message: passed
      ? `Semantic HTML found: ${parts.join("; ")}`
      : "No semantic HTML structure found on any reviewed page",
    details: { pagesPassing, totalPages, pageResults },
  };
}
