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
      return {
        name: "llms.txt",
        passed: false,
        message: `llms.txt not found (HTTP ${response.status})`,
        details: { statusCode: response.status, url: llmsUrl },
      };
    }

    const content = await response.text();
    const elapsed = Date.now() - startTime;

    const lines = content.split("\n").filter((line) => line.trim());
    const hasContent = lines.length > 0;

    if (!hasContent) {
      return {
        name: "llms.txt",
        passed: true,
        message: "llms.txt exists but is empty",
        details: { url: llmsUrl, elapsed },
      };
    }

    return {
      name: "llms.txt",
      passed: true,
      message: `llms.txt found with ${lines.length} lines`,
      details: { url: llmsUrl, lineCount: lines.length, elapsed },
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
