/**
 * Spec: llmstxt.org
 * Required: file must exist and have content.
 * Informative: H1 title, H2 sections with file links, blockquote.
 * The "## Optional" section marks content below it as skip-able by AI agents.
 * Structure issues are advisory — the file being present and non-empty is
 * enough to pass.
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

    // Always pass — structure notes are informative
    const notes: string[] = [];

    if (!hasH1) {
      notes.push("no H1 title (recommended)");
    }

    if (h2Sections.length === 0) {
      notes.push("no H2 sections (recommended)");
    }

    if (!hasFileLinks) {
      notes.push("no file links in [name](url) format (recommended)");
    }

    if (hasOptionalSection) {
      const optionalIndex = lines.findIndex(
        (line) =>
          /^##\s+Optional\b/i.test(line) || /^##\s+Optional\s*$/.test(line),
      );
      const contentAfterOptional = lines
        .slice(optionalIndex + 1)
        .filter((line) => line.trim() && !line.trim().startsWith("#"));
      if (contentAfterOptional.length > 0) {
        notes.push("content under 'Optional' section should be moved above it");
      } else {
        notes.push("has 'Optional' section — content below is skip-able");
      }
    }

    const message =
      notes.length > 0
        ? `llms.txt with ${nonEmptyLines.length} lines. Notes: ${notes.join("; ")}`
        : `llms.txt with ${nonEmptyLines.length} lines, well-structured`;

    return {
      name: "llms.txt",
      passed: true,
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
