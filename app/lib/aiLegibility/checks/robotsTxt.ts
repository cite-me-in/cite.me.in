import type { CheckResult } from "../types";

export default async function checkRobotsTxt({
  url,
  log,
}: {
  log: (line: string) => Promise<void>;
  url: string;
}): Promise<CheckResult> {
  await log("Checking robots.txt...");
  const robotsUrl = new URL("/robots.txt", url).href;
  const startTime = Date.now();

  try {
    const response = await fetch(robotsUrl, {
      headers: {
        "User-Agent": "CiteMeIn-AI-Legibility-Bot/1.0",
        Accept: "text/plain",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const message = `robots.txt not found (HTTP ${response.status})`;
      await log(`✗ ${message}`);
      return {
        name: "robots.txt",
        category: "important",
        passed: false,
        message,
        details: { statusCode: response.status, url: robotsUrl },
      };
    }

    const content = await response.text();
    const elapsed = Date.now() - startTime;

    const lines = content.split("\n").filter((line) => line.trim());
    const hasUserAgent = lines.some((line) => /user-agent/i.test(line));
    const hasAllowOrDisallow = lines.some((line) =>
      /allow|disallow/i.test(line),
    );
    const hasSitemap = lines.some((line) => /sitemap/i.test(line));

    if (!hasUserAgent && !hasAllowOrDisallow) {
      const message = "robots.txt exists but has no crawl rules";
      await log(`✗ ${message}`);
      return {
        name: "robots.txt",
        category: "important",
        passed: true,
        message,
        details: {
          url: robotsUrl,
          lineCount: lines.length,
          hasSitemap,
          elapsed,
        },
      };
    }

    const message = `robots.txt found with ${lines.length} lines${hasSitemap ? " (includes sitemap reference)" : ""}`;
    await log(`✓ ${message}`);
    return {
      name: "robots.txt",
      category: "important",
      passed: true,
      message,
      details: { url: robotsUrl, lineCount: lines.length, hasSitemap, elapsed },
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    if (error instanceof Error && error.name === "TimeoutError") {
      const message = "robots.txt request timed out (10s limit)";
      await log(`✗ ${message}`);
      return {
        name: "robots.txt",
        category: "important",
        passed: false,
        message,
        timedOut: true,
        details: { url: robotsUrl },
      };
    }
    const message = `Failed to fetch robots.txt: ${errorMessage}`;
    await log(`✗ ${message}`);
    return {
      name: "robots.txt",
      category: "important",
      passed: false,
      message,
      details: { url: robotsUrl, error: errorMessage },
    };
  }
}
