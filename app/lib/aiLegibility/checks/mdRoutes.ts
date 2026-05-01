import type { CheckResult } from "~/lib/aiLegibility/types";

export default async function checkMdRoutes({
  url,
}: {
  url: string;
}): Promise<Omit<CheckResult, "category">> {
  try {
    const mdUrl = url.endsWith("/") ? `${url}index.md` : `${url}/index.md`;
    const response = await fetch(mdUrl, {
      headers: {
        "User-Agent": "CiteMeIn-AI-Legibility-Bot/1.0",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (response.status === 404)
      return {
        name: ".md routes",
        passed: false,
        message: "No .md version of homepage found",
        details: { mdUrl, status: 404 },
      };

    if (!response.ok)
      return {
        name: ".md routes",
        passed: false,
        message: `.md route returned HTTP ${response.status}`,
        details: { mdUrl, status: response.status },
      };

    const contentType = response.headers.get("content-type") ?? "";
    const isMarkdown =
      contentType.includes("text/markdown") ||
      contentType.includes("text/plain");

    const text = await response.text();
    if (text.length < 50)
      return {
        name: ".md routes",
        passed: false,
        message: ".md route exists but contains very little content",
        details: { mdUrl, contentLength: text.length },
      };

    return {
      name: ".md routes",
      passed: true,
      message: `.md route serves ${text.length} chars of content`,
      details: { mdUrl, contentType, contentLength: text.length, isMarkdown },
    };
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError")
      return {
        name: ".md routes",
        passed: false,
        message: ".md routes check timed out (10s limit)",
        timedOut: true,
      };
    return {
      name: ".md routes",
      passed: false,
      message: `Failed to check .md routes: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
