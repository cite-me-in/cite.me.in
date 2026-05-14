/**
 * Spec: RFC 7231 (HTTP Content Negotiation)
 * When a client sends Accept: text/markdown, the server should respond
 * with a Markdown version of the page (Content-Type: text/markdown).
 * Required: at least one reviewed page must serve markdown content
 * when requested with Accept: text/markdown.
 */

import { map } from "radashi";
import type { CheckResult } from "~/lib/aiLegibility/types";

type PageResult = {
  url: string;
  ok: boolean;
  isMarkdown: boolean;
  contentType: string;
  contentLength: number;
  status: number;
};

export default async function checkMarkdownNegotiation({
  pages,
}: {
  pages: { url: string }[];
}): Promise<Omit<CheckResult, "category">> {
  try {
    const pageResults = await map(pages, ({ url }) => checkPage(url));
    const anyValidMarkdown = pageResults.some(
      (result) => result.ok && result.isMarkdown && result.contentLength > 50,
    );
    const anyMarkdownContentType = pageResults.some(
      (result) => result.isMarkdown && result.contentLength > 0,
    );

    if (anyValidMarkdown) {
      const validPages = pageResults.filter(
        (result) => result.ok && result.isMarkdown && result.contentLength > 50,
      );
      return {
        name: "Markdown content negotiation",
        passed: true,
        message: `Markdown content negotiation supported: ${validPages.length}/${pages.length} pages serve markdown`,
        details: {
          pagesChecked: pages.length,
          pagesWithMarkdown: validPages.length,
        },
      };
    }

    if (anyMarkdownContentType) {
      const lowContent = pageResults.filter(
        (result) => result.isMarkdown && result.contentLength <= 50,
      );
      const sources = lowContent.map((result) => `${result.url} (${result.contentLength} chars)`);
      return {
        name: "Markdown content negotiation",
        passed: false,
        message: `Markdown content-type returned but body too short: ${sources.join("; ")}`,
        details: {
          pagesChecked: pages.length,
        },
      };
    }

    const notAcceptable = pageResults.filter((result) => result.status === 406);
    if (notAcceptable.length > 0) {
      return {
        name: "Markdown content negotiation",
        passed: false,
        message: `${notAcceptable.length} page${notAcceptable.length > 1 ? "s" : ""} return HTTP 406 (Not Acceptable) for Accept: text/markdown`,
        details: {
          pagesChecked: pages.length,
          notAcceptablePages: notAcceptable.length,
        },
      };
    }

    return {
      name: "Markdown content negotiation",
      passed: false,
      message: "No page serves markdown content",
      details: { pagesChecked: pages.length },
    };
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return {
        name: "Markdown content negotiation",
        passed: false,
        message: "Markdown negotiation request timed out (10s limit)",
        timedOut: true,
      };
    }
    return {
      name: "Markdown content negotiation",
      passed: false,
      message: `Failed to check markdown negotiation: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

async function checkPage(url: string): Promise<PageResult> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "CiteMeIn-AI-Legibility-Bot/1.0",
        Accept: "text/markdown",
      },
      signal: AbortSignal.timeout(10_000),
    });

    const contentType = response.headers.get("Content-Type") ?? "";
    const isMarkdown =
      contentType.startsWith("text/markdown") || contentType.startsWith("text/plain");
    const text = response.ok ? await response.text() : "";
    const contentLength = text.trim().length;

    return {
      url,
      ok: response.ok,
      isMarkdown,
      contentType,
      contentLength,
      status: response.status,
    };
  } catch {
    return {
      url,
      ok: false,
      isMarkdown: false,
      contentType: "",
      contentLength: 0,
      status: 0,
    };
  }
}
