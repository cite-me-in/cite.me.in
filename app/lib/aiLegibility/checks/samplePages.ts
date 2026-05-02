import type { CheckResult, FetchedPage } from "~/lib/aiLegibility/types";
import { assessContent } from "./extractContent";

type PageResult = {
  url: string;
  passed: boolean;
  message: string;
  timedOut: boolean;
  html?: string;
  responseHeaders?: Record<string, string>;
};

export default async function checkSamplePages({
  pages,
}: {
  pages: FetchedPage[];
}): Promise<Omit<CheckResult, "category"> & { pages: PageResult[] }> {
  const startTime = Date.now();

  if (pages.length === 0) {
    return {
      name: "Sample pages",
      passed: false,
      message: "No sample URLs found in sitemap",
      details: { sitemapUrlCount: 0 },
      pages: [],
    };
  }

  const results: PageResult[] = [];

  for (const page of pages) {
    if (page.timedOut) {
      results.push({
        url: page.url,
        passed: false,
        message: "Timed out (10s limit)",
        timedOut: true,
      });
      continue;
    }

    if (!page.ok) {
      results.push({
        url: page.url,
        passed: false,
        message: page.error ?? `HTTP ${page.status}`,
        timedOut: false,
        responseHeaders: page.headers,
      });
      continue;
    }

    const content = await assessContent(page.html, page.url);

    if (content.isSpaShell && !content.hasRealContent) {
      results.push({
        url: page.url,
        passed: false,
        message: `Empty SPA shell (${content.contentLength} chars)`,
        timedOut: false,
        responseHeaders: page.headers,
      });
      continue;
    }

    if (!content.useful) {
      results.push({
        url: page.url,
        passed: false,
        message: `Minimal content (${content.contentLength} chars, ${content.wordCount} words)${content.usefulnessSignals.length > 0 ? `: ${content.usefulnessSignals.join(", ")}` : ""}`,
        timedOut: false,
        responseHeaders: page.headers,
      });
      continue;
    }

    const details = [
      `${content.contentLength.toLocaleString()} chars`,
      `${content.wordCount} words`,
    ];
    if (content.paragraphs) details.push("paragraphs");
    if (content.sentenceEndings) details.push("sentences");
    if (content.headings) details.push("headings");

    results.push({
      url: page.url,
      passed: true,
      message: `${details.join(", ")}`,
      timedOut: false,
      html: page.html,
      responseHeaders: page.headers,
    });
  }

  const passedCount = results.filter((r) => r.passed).length;
  const timedOutCount = results.filter((r) => r.timedOut).length;
  const totalCount = results.length;
  const elapsed = Date.now() - startTime;

  if (passedCount === totalCount) {
    return {
      name: "Sample pages",
      passed: true,
      message: `All ${totalCount} sample pages have meaningful content`,
      details: { passedCount, totalCount, timedOutCount, elapsed },
      pages: results,
    };
  }

  return {
    name: "Sample pages",
    passed: false,
    message: `${passedCount}/${totalCount} pages have meaningful content${timedOutCount > 0 ? ` (${timedOutCount} timed out)` : ""}`,
    details: { passedCount, totalCount, timedOutCount, elapsed },
    pages: results,
  };
}
