/**
 * Spec: RFC 7231 (HTTP Content Negotiation)
 * When a client sends Accept: text/markdown, the server should respond
 * with a Markdown version of the page (Content-Type: text/markdown).
 * Required: at least one page (homepage or sample page) must serve
 * markdown content when requested with Accept: text/markdown.
 */

import type { CheckResult } from "~/lib/aiLegibility/types";

type PageResult = {
  url: string;
  ok: boolean;
  isMarkdown: boolean;
  contentType: string;
  contentLength: number;
  status: number;
};

async function checkPage(url: string): Promise<PageResult> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "CiteMeIn-AI-Legibility-Bot/1.0",
      Accept: "text/markdown",
    },
    signal: AbortSignal.timeout(10_000),
  });

  const contentType = response.headers.get("Content-Type") ?? "";
  const isMarkdown =
    contentType.startsWith("text/markdown") ||
    contentType.startsWith("text/plain");
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
}

export default async function checkMarkdownNegotiation({
  url,
  pages,
}: {
  url: string;
  pages?: { url: string }[];
}): Promise<
  Omit<CheckResult, "category"> & {
    pageResults?: PageResult[];
  }
> {
  try {
    const homepageResult = await checkPage(url);

    const pageResults: PageResult[] = [];
    if (pages) {
      for (const page of pages) {
        try {
          const result = await checkPage(page.url);
          pageResults.push(result);
        } catch {
          pageResults.push({
            url: page.url,
            ok: false,
            isMarkdown: false,
            contentType: "",
            contentLength: 0,
            status: 0,
          });
        }
      }
    }

    const allResults = [homepageResult, ...pageResults];
    const pagesChecked = pages?.length ?? 0;

    const anyValidMarkdown = allResults.some(
      (r) => r.ok && r.isMarkdown && r.contentLength > 50,
    );
    const anyMarkdownContentType = allResults.some(
      (r) => r.isMarkdown && r.contentLength > 0,
    );

    if (anyValidMarkdown) {
      const sources: string[] = [];
      if (
        homepageResult.ok &&
        homepageResult.isMarkdown &&
        homepageResult.contentLength > 50
      )
        sources.push(`Homepage (${homepageResult.contentLength} chars)`);
      const validPages = pageResults.filter(
        (r) => r.ok && r.isMarkdown && r.contentLength > 50,
      );
      if (validPages.length > 0)
        sources.push(
          `${validPages.length}/${pagesChecked} sample pages serve markdown`,
        );
      return {
        name: "Markdown content negotiation",
        passed: true,
        message: `Markdown content negotiation supported: ${sources.join("; ")}`,
        details: {
          homepageContentType: homepageResult.contentType,
          pagesChecked,
          pagesWithMarkdown: validPages.length,
        },
        pageResults: allResults,
      };
    }

    if (anyMarkdownContentType) {
      const lowContent = allResults.filter(
        (r) => r.isMarkdown && r.contentLength <= 50,
      );
      const sources = lowContent.map(
        (r) =>
          `${r.url === url ? "Homepage" : r.url} (${r.contentLength} chars)`,
      );
      return {
        name: "Markdown content negotiation",
        passed: false,
        message: `Markdown content-type returned but body too short: ${sources.join("; ")}`,
        details: {
          homepageContentType: homepageResult.contentType,
          pagesChecked,
        },
        pageResults: allResults,
      };
    }

    const notAcceptable = allResults.filter((r) => r.status === 406);
    if (notAcceptable.length > 0) {
      return {
        name: "Markdown content negotiation",
        passed: false,
        message: `${notAcceptable.length} page${notAcceptable.length > 1 ? "s" : ""} return HTTP 406 (Not Acceptable) for Accept: text/markdown`,
        details: {
          homepageContentType: homepageResult.contentType,
          pagesChecked,
          notAcceptablePages: notAcceptable.length,
        },
        pageResults: allResults,
      };
    }

    return {
      name: "Markdown content negotiation",
      passed: false,
      message: `No page serves markdown content (homepage Content-Type: ${homepageResult.contentType || "none"})`,
      details: {
        homepageContentType: homepageResult.contentType,
        pagesChecked,
      },
      pageResults: allResults,
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
