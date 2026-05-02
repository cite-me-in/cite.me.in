import type { CheckResult } from "../types";
import { assessContent, extractHeaders } from "./extractContent";

export default async function checkHomepageContent({
  url,
}: {
  url: string;
}): Promise<
  Omit<CheckResult, "category"> & {
    html: string;
    responseHeaders: Headers;
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

    const content = await assessContent(html, url);

    if (content.isSpaShell && !content.hasRealContent) {
      return {
        name: "Homepage content",
        passed: false,
        message: `Homepage appears to be an empty SPA shell (${content.contentLength} characters after extraction)`,
        details: {
          contentLength: content.contentLength,
          isSpaShell: true,
          elapsed,
        },
        html,
        responseHeaders,
      };
    }

    if (!content.useful) {
      return {
        name: "Homepage content",
        passed: false,
        message: `Homepage has minimal content (${content.contentLength} chars, ${content.wordCount} words)${content.usefulnessSignals.length > 0 ? `: ${content.usefulnessSignals.join(", ")}` : ""}`,
        details: {
          contentLength: content.contentLength,
          wordCount: content.wordCount,
          hasParagraphs: content.paragraphs,
          hasSentenceEndings: content.sentenceEndings,
          hasHeadings: content.headings,
          elapsed,
        },
        html,
        responseHeaders,
      };
    }

    const details = [
      `${content.contentLength.toLocaleString()} chars`,
      `${content.wordCount} words`,
    ];
    if (content.paragraphs) details.push("paragraphs");
    if (content.sentenceEndings) details.push("sentences");
    if (content.headings) details.push("headings");

    return {
      name: "Homepage content",
      passed: true,
      message: `Homepage has ${details.join(", ")}`,
      details: {
        contentLength: content.contentLength,
        wordCount: content.wordCount,
        hasParagraphs: content.paragraphs,
        hasSentenceEndings: content.sentenceEndings,
        hasHeadings: content.headings,
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
        responseHeaders: new Headers(),
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
      responseHeaders: new Headers(),
    };
  }
}
