import type { CheckResult } from "~/lib/aiLegibility/types";

export default async function checkContentSignals({
  url,
}: {
  url: string;
}): Promise<Omit<CheckResult, "category">> {
  const robotsUrl = new URL("/robots.txt", url).href;

  try {
    const response = await fetch(robotsUrl, {
      headers: {
        "User-Agent": "CiteMeIn-AI-Legibility-Bot/1.0",
        Accept: "text/plain",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return {
        name: "Content Signals",
        passed: false,
        message: `Could not check Content-Signal — robots.txt returned HTTP ${response.status}`,
        details: { statusCode: response.status },
      };
    }

    const content = await response.text();
    const contentSignalLines = content
      .split("\n")
      .filter(
        (line) =>
          /^Content-Signal\s*:/i.test(line.trim()) ||
          /^#\s*Content-Signal\s*:/i.test(line.trim()),
      );

    if (contentSignalLines.length > 0) {
      return {
        name: "Content Signals",
        passed: true,
        message: `Content-Signal found in robots.txt — ${contentSignalLines.length} directive${contentSignalLines.length > 1 ? "s" : ""}`,
        details: { contentSignalLines },
      };
    }

    return {
      name: "Content Signals",
      passed: false,
      message:
        "No Content-Signal found in robots.txt — AI agents lack a content usage signal",
      details: { contentSignalLines: [] },
    };
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return {
        name: "Content Signals",
        passed: false,
        message: "Content-Signal check timed out (10s limit)",
        timedOut: true,
      };
    }
    return {
      name: "Content Signals",
      passed: false,
      message: `Failed to check Content-Signal: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
