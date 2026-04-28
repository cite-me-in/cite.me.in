import type { CheckResult } from "~/lib/aiLegibility/types";

export default async function checkMarkdownNegotiation({
  url,
}: {
  url: string;
}): Promise<CheckResult> {
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
      contentType.startsWith("text/markdown") ||
      contentType.startsWith("text/plain");

    if (response.ok && isMarkdown) {
      const text = await response.text();
      const hasContent = text.trim().length > 50;
      return {
        name: "Markdown content negotiation",
        category: "trusted",
        passed: hasContent,
        message: hasContent
          ? `Homepage serves markdown (${text.trim().length} chars) when requested with Accept: text/markdown`
          : "Homepage responds with markdown content-type but body is minimal",
        details: { contentType, contentLength: text.trim().length },
      };
    }

    if (response.status === 406) {
      return {
        name: "Markdown content negotiation",
        category: "trusted",
        passed: false,
        message:
          "Homepage returns HTTP 406 (Not Acceptable) for Accept: text/markdown — markdown content negotiation not supported",
        details: { contentType },
      };
    }

    return {
      name: "Markdown content negotiation",
      category: "trusted",
      passed: false,
      message: `Homepage does not serve markdown (Content-Type: ${contentType || "none"})`,
      details: { contentType },
    };
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return {
        name: "Markdown content negotiation",
        category: "trusted",
        passed: false,
        message: "Markdown negotiation request timed out (10s limit)",
        timedOut: true,
      };
    }
    return {
      name: "Markdown content negotiation",
      category: "trusted",
      passed: false,
      message: `Failed to check markdown negotiation: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
