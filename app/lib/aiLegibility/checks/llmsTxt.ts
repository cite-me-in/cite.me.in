/**
 * Spec: llmstxt.org
 * Required: H1 title (# Title)
 * Optional: blockquote (> description), H2 sections with file links ([name](url): notes)
 * The "## Optional" section marks content below it as skip-able by AI agents
 */

import type { CheckResult } from "~/lib/aiLegibility/types";

export default async function checkLlmsTxt({
  url,
}: {
  url: string;
}): Promise<Omit<CheckResult, "category">> {
  const llmsUrl = new URL("/llms.txt", url).href;
  const startTime = Date.now();

  try {
    const response = await fetch(llmsUrl, {
      headers: {
        "User-Agent": "CiteMeIn-AI-Legibility-Bot/1.0",
        Accept: "text/plain",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      if (response.status === 404) {
        return {
          name: "llms.txt",
          passed: false,
          message: "llms.txt not found (HTTP 404) — AI discoverability limited",
          details: { statusCode: response.status, url: llmsUrl },
        };
      }
      return {
        name: "llms.txt",
        passed: false,
        message: `llms.txt returned HTTP ${response.status}`,
        details: { statusCode: response.status, url: llmsUrl },
      };
    }

    const content = await response.text();
    const elapsed = Date.now() - startTime;

    const lines = content.split("\n");
    const nonEmptyLines = lines.filter((line) => line.trim());

    if (nonEmptyLines.length === 0) {
      return {
        name: "llms.txt",
        passed: false,
        message:
          "llms.txt exists but is empty — needs at least an H1 title per spec",
        details: { url: llmsUrl, elapsed },
      };
    }

    const hasH1 = lines.some((line) => /^#\s+\S/.test(line));
    const h2Sections = lines
      .map((line, i) => ({ line: line.trim(), index: i }))
      .filter(({ line }) => /^##\s+\S/.test(line));
    const hasFileLinks = nonEmptyLines.some((line) =>
      /^\s*-\s+\[.+\]\(.+\)/.test(line),
    );
    const blockquoteLines = lines.filter((line) => /^>\s/.test(line));
    const hasBlockquote = blockquoteLines.length > 0;
    const hasOptionalSection = lines.some(
      (line) =>
        /^##\s+Optional\b/i.test(line) || /^##\s+Optional\s*$/.test(line),
    );

    const issues: string[] = [];

    if (!hasH1) {
      issues.push("missing H1 title (required by spec)");
    }

    if (h2Sections.length === 0) {
      issues.push("no H2 sections found");
    }

    if (!hasFileLinks) {
      issues.push("no file links found (use [name](url) format)");
    }

    const passed = hasH1 && h2Sections.length > 0;
    const warnParts: string[] = [];
    if (hasOptionalSection) {
      const optionalIndex = lines.findIndex(
        (line) =>
          /^##\s+Optional\b/i.test(line) || /^##\s+Optional\s*$/.test(line),
      );
      const contentAfterOptional = lines
        .slice(optionalIndex + 1)
        .filter((line) => line.trim() && !line.trim().startsWith("#"));
      if (contentAfterOptional.length > 0) {
        warnParts.push(
          "content under 'Optional' section should be moved above it",
        );
      } else {
        warnParts.push("has 'Optional' section");
      }
    }

    const message = passed
      ? `llms.txt has valid structure: H1 title, ${h2Sections.length} section${h2Sections.length === 1 ? "" : "s"}${!hasFileLinks ? ", no file links" : ""}${warnParts.length > 0 ? `. Note: ${warnParts.join("; ")}` : ""}`
      : `llms.txt issues: ${issues.join("; ")}${warnParts.length > 0 ? `. Note: ${warnParts.join("; ")}` : ""}`;

    return {
      name: "llms.txt",
      passed,
      message,
      details: {
        url: llmsUrl,
        elapsed,
        lineCount: nonEmptyLines.length,
        hasH1,
        h2SectionCount: h2Sections.length,
        hasFileLinks,
        hasBlockquote,
        hasOptionalSection,
      },
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    if (error instanceof Error && error.name === "TimeoutError") {
      return {
        name: "llms.txt",
        passed: false,
        message: "llms.txt request timed out (10s limit)",
        timedOut: true,
        details: { url: llmsUrl },
      };
    }
    return {
      name: "llms.txt",
      passed: false,
      message: `Failed to fetch llms.txt: ${errorMessage}`,
      details: { url: llmsUrl, error: errorMessage },
    };
  }
}
