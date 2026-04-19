import type { CheckResult } from "../types";

export default async function checkLlmsTxt({
  url,
  log,
}: {
  url: string;
  log: (line: string) => Promise<void>;
}): Promise<CheckResult> {
  await log("Checking llms.txt...");
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
      const message = `llms.txt not found (HTTP ${response.status})`;
      await log(`✗ ${message}`);
      return {
        name: "llms.txt",
        category: "optimization",
        passed: false,
        message,
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
        category: "optimization",
        passed: true,
        message: "llms.txt exists but is empty",
        details: { url: llmsUrl, elapsed },
      };
    }

    const message = `llms.txt found with ${lines.length} lines`;
    await log(`✓ ${message}`);
    return {
      name: "llms.txt",
      category: "optimization",
      passed: true,
      message,
      details: { url: llmsUrl, lineCount: lines.length, elapsed },
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    if (error instanceof Error && error.name === "TimeoutError") {
      const message = "llms.txt request timed out (10s limit)";
      await log(`✗ ${message}`);
      return {
        name: "llms.txt",
        category: "optimization",
        passed: false,
        message,
        timedOut: true,
        details: { url: llmsUrl },
      };
    }
    const message = `Failed to fetch llms.txt: ${errorMessage}`;
    await log(`✗ ${message}`);
    return {
      name: "llms.txt",
      category: "optimization",
      passed: false,
      message,
      details: { url: llmsUrl, error: errorMessage },
    };
  }
}
