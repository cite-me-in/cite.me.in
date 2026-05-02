import type { CheckResult } from "../types";
import extractContent, {
  MIN_CONTENT_LENGTH,
  MIN_WORD_COUNT,
  SPA_PATTERNS,
  extractHeaders,
  hasParagraphs,
  hasSentenceEndings,
  hasHeadings,
} from "./extractContent";

export default async function checkHomepageContent({
  url,
}: {
  url: string;
}): Promise<
  Omit<CheckResult, "category"> & {
    html: string;
    responseHeaders: Record<string, string>;
  }
> {
  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "CiteMeIn-AI-Legibility-Bot/1.0",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(10_000),
    });

    const html = await response.text();
    const elapsed = Date.now() - startTime;
    const responseHeaders = extractHeaders(response);

    if (!response.ok) {
      return {
        name: "Homepage content",
        passed: false,
        message: `Homepage returned HTTP ${response.status}`,
        details: { statusCode: response.status, elapsed },
        html,
        responseHeaders,
      };
    }

    const { textContent, wordCount } = await extractContent(html, url);
    const contentLength = textContent.length;

    const isSpaShell = SPA_PATTERNS.some((pattern) => pattern.test(html));
    const hasRealContent = contentLength >= MIN_CONTENT_LENGTH;
    const enoughWords = wordCount >= MIN_WORD_COUNT;
    const paragraphs = hasParagraphs(textContent);
    const sentenceEndings = hasSentenceEndings(textContent);
    const headings = hasHeadings(html);

    if (isSpaShell && !hasRealContent) {
      return {
        name: "Homepage content",
        passed: false,
        message: `Homepage appears to be an empty SPA shell (${contentLength} characters after extraction)`,
        details: { contentLength, isSpaShell: true, elapsed },
        html,
        responseHeaders,
      };
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
      return {
        name: "Homepage content",
        passed: false,
        message: `Homepage has minimal content (${contentLength} chars, ${wordCount} words)${usefulnessSignals.length > 0 ? `: ${usefulnessSignals.join(", ")}` : ""}`,
        details: {
          contentLength,
          wordCount,
          hasParagraphs: paragraphs,
          hasSentenceEndings: sentenceEndings,
          hasHeadings: headings,
          elapsed,
        },
        html,
        responseHeaders,
      };
    }

    const details = [
      `${contentLength.toLocaleString()} chars`,
      `${wordCount} words`,
    ];
    if (paragraphs) details.push("paragraphs");
    if (sentenceEndings) details.push("sentences");
    if (headings) details.push("headings");

    return {
      name: "Homepage content",
      passed: true,
      message: `Homepage has ${details.join(", ")}`,
      details: {
        contentLength,
        wordCount,
        hasParagraphs: paragraphs,
        hasSentenceEndings: sentenceEndings,
        hasHeadings: headings,
        elapsed,
      },
      html,
      responseHeaders,
    };
  } catch (error) {
    const elapsed = Date.now() - startTime;
    if (error instanceof Error && error.name === "TimeoutError") {
      return {
        name: "Homepage content",
        passed: false,
        message: "Homepage request timed out (10s limit)",
        timedOut: true,
        details: { elapsed },
        html: "",
        responseHeaders: {},
      };
    }
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const isDnsError =
      errorMessage.includes("ENOTFOUND") || errorMessage.includes("EAI_AGAIN");
    return {
      name: "Homepage content",
      passed: false,
      message: isDnsError
        ? `Could not resolve domain: ${new URL(url).hostname}`
        : `Failed to fetch homepage: ${errorMessage}`,
      details: { elapsed, error: errorMessage },
      html: "",
      responseHeaders: {},
    };
  }
}
