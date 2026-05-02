import type { CheckResult } from "~/lib/aiLegibility/types";
import extractContent, {
  MIN_CONTENT_LENGTH,
  MIN_WORD_COUNT,
  SPA_PATTERNS,
  extractHeaders,
  hasParagraphs,
  hasSentenceEndings,
  hasHeadings,
} from "./extractContent";

type PageResult = {
  url: string;
  passed: boolean;
  message: string;
  timedOut: boolean;
  contentLength: number;
  wordCount: number;
  hasParagraphs: boolean;
  hasSentenceEndings: boolean;
  hasHeadings: boolean;
  html?: string;
  responseHeaders?: Record<string, string>;
};

export default async function checkSamplePages({
  sampleURLs,
  url,
}: {
  sampleURLs: string[];
  url: string;
}): Promise<Omit<CheckResult, "category"> & { pages: PageResult[] }> {
  const startTime = Date.now();
  const TOTAL_TIMEOUT = 120_000;
  const PAGE_TIMEOUT = 10_000;

  const pagesToCheck = sampleURLs.filter((u) => u !== url);

  if (pagesToCheck.length === 0) {
    return {
      name: "Sample pages",
      passed: false,
      message: "No sample URLs found in sitemap",
      details: { sitemapUrlCount: sampleURLs.length },
      pages: [],
    };
  }

  const results: PageResult[] = [];

  for (const pageUrl of pagesToCheck) {
    const totalElapsed = Date.now() - startTime;
    if (totalElapsed >= TOTAL_TIMEOUT) {
      results.push({
        url: pageUrl,
        passed: false,
        message: "Skipped (total timeout exceeded)",
        timedOut: true,
        contentLength: 0,
        wordCount: 0,
        hasParagraphs: false,
        hasSentenceEndings: false,
        hasHeadings: false,
      });
      continue;
    }

    try {
      const response = await fetch(pageUrl, {
        headers: {
          "User-Agent": "CiteMeIn-AI-Legibility-Bot/1.0",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(
          Math.min(PAGE_TIMEOUT, TOTAL_TIMEOUT - totalElapsed),
        ),
      });

      const html = await response.text();
      const responseHeaders = extractHeaders(response);

      if (!response.ok) {
        results.push({
          url: pageUrl,
          passed: false,
          message: `HTTP ${response.status}`,
          timedOut: false,
          contentLength: 0,
          wordCount: 0,
          hasParagraphs: false,
          hasSentenceEndings: false,
          hasHeadings: false,
          responseHeaders,
        });
        continue;
      }

      const { textContent, wordCount } = await extractContent(html, pageUrl);
      const contentLength = textContent.length;

      const isSpaShell = SPA_PATTERNS.some((pattern) => pattern.test(html));
      const hasRealContent = contentLength >= MIN_CONTENT_LENGTH;
      const enoughWords = wordCount >= MIN_WORD_COUNT;
      const paragraphs = hasParagraphs(textContent);
      const sentenceEndings = hasSentenceEndings(textContent);
      const headings = hasHeadings(html);

      if (isSpaShell && !hasRealContent) {
        results.push({
          url: pageUrl,
          passed: false,
          message: `Empty SPA shell (${contentLength} chars)`,
          timedOut: false,
          contentLength,
          wordCount,
          hasParagraphs: paragraphs,
          hasSentenceEndings: sentenceEndings,
          hasHeadings: headings,
        });
        continue;
      }

      const usefulnessSignals: string[] = [];
      if (!paragraphs) usefulnessSignals.push("no paragraph breaks");
      if (!sentenceEndings) usefulnessSignals.push("no sentence structure");
      if (!headings) usefulnessSignals.push("no headings");
      if (!enoughWords)
        usefulnessSignals.push(
          `only ${wordCount} words (need ${MIN_WORD_COUNT})`,
        );

      const useful = hasRealContent && enoughWords;

      if (!useful) {
        results.push({
          url: pageUrl,
          passed: false,
          message: `Minimal content (${contentLength} chars, ${wordCount} words)${usefulnessSignals.length > 0 ? `: ${usefulnessSignals.join(", ")}` : ""}`,
          timedOut: false,
          contentLength,
          wordCount,
          hasParagraphs: paragraphs,
          hasSentenceEndings: sentenceEndings,
          hasHeadings: headings,
        });
        continue;
      }

      const details = [
        `${contentLength.toLocaleString()} chars`,
        `${wordCount} words`,
      ];
      if (paragraphs) details.push("paragraphs");
      if (sentenceEndings) details.push("sentences");
      if (headings) details.push("headings");

      results.push({
        url: pageUrl,
        passed: true,
        message: `${details.join(", ")}`,
        timedOut: false,
        contentLength,
        wordCount,
        hasParagraphs: paragraphs,
        hasSentenceEndings: sentenceEndings,
        hasHeadings: headings,
        html,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        results.push({
          url: pageUrl,
          passed: false,
          message: "Timed out (10s limit)",
          timedOut: true,
          contentLength: 0,
          wordCount: 0,
          hasParagraphs: false,
          hasSentenceEndings: false,
          hasHeadings: false,
        });
      } else {
        results.push({
          url: pageUrl,
          passed: false,
          message: error instanceof Error ? error.message : "Unknown error",
          timedOut: false,
          contentLength: 0,
          wordCount: 0,
          hasParagraphs: false,
          hasSentenceEndings: false,
          hasHeadings: false,
        });
      }
    }
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
