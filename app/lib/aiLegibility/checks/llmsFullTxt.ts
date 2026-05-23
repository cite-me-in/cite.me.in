/**
 * Spec: llmstxt.org — llms-full.txt
 * A file at /llms-full.txt containing the site's full content in a single
 * Markdown file. AI tools like ChatGPT can ingest everything in one fetch.
 * Required: file must exist and have content.
 */

import type { CheckResult } from "~/lib/aiLegibility/types";

export default async function checkLlmsFullTxt({
  url,
}: {
  url: string;
}): Promise<Omit<CheckResult, "category">> {
  const llmsFullURL = new URL("/llms-full.txt", url).href;

  try {
    const response = await fetch(llmsFullURL, {
      headers: {
        "User-Agent": "CiteMeIn-AI-Legibility-Bot/1.0",
        Accept: "text/plain",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (response.status === 404)
      return {
        name: "llms-full.txt",
        passed: false,
        message:
          "llms-full.txt not found — create one to give AI agents your full content in one fetch",
        details: { statusCode: response.status, url: llmsFullURL },
      };

    if (!response.ok)
      return {
        name: "llms-full.txt",
        passed: false,
        message: `llms-full.txt returned HTTP ${response.status}`,
        details: { statusCode: response.status, url: llmsFullURL },
      };

    const content = await response.text();
    const nonEmptyLines = content.split("\n").filter((l) => l.trim());

    const passed = nonEmptyLines.length > 0;

    return {
      name: "llms-full.txt",
      passed,
      message: passed
        ? `llms-full.txt found with ${nonEmptyLines.length} lines of content`
        : "llms-full.txt exists but is empty",
      details: { url: llmsFullURL, lineCount: nonEmptyLines.length },
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    if (error instanceof Error && error.name === "TimeoutError")
      return {
        name: "llms-full.txt",
        passed: false,
        message: "llms-full.txt request timed out (10s limit)",
        timedOut: true,
        details: { url: llmsFullURL },
      };

    return {
      name: "llms-full.txt",
      passed: false,
      message: `Failed to fetch llms-full.txt: ${errorMessage}`,
      details: { url: llmsFullURL, error: errorMessage },
    };
  }
}
