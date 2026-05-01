import type { CheckResult } from "~/lib/aiLegibility/types";

const MIN_CONTENT_LENGTH = 100;
const SPA_PATTERNS = [
  /<div\s+id\s*=\s*["']root["']/i,
  /<div\s+id\s*=\s*["']app["']/i,
  /<div\s+class\s*=\s*["']app["']/i,
];

export default async function checkHomepageContent({
  url,
}: {
  url: string;
}): Promise<Omit<CheckResult, "category"> & { html: string }> {
  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "CiteMeIn-AI-Legibility-Bot/1.0",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(10_000),
    });

    const html = await response.text();
    const elapsed = Date.now() - startTime;

    if (!response.ok) {
      return {
        name: "Homepage content",
        passed: false,
        message: `Homepage returned HTTP ${response.status}`,
        details: { statusCode: response.status, elapsed },
        html,
      };
    }

    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const bodyContent = bodyMatch?.[1] ?? html;
    const textContent = bodyContent.replace(/<[^>]+>/g, "").trim();
    const contentLength = textContent.length;

    const isSpaShell = SPA_PATTERNS.some((pattern) => pattern.test(html));
    const hasRealContent = contentLength >= MIN_CONTENT_LENGTH;

    if (isSpaShell && !hasRealContent) {
      return {
        name: "Homepage content",
        passed: false,
        message: `Homepage appears to be an empty SPA shell (${contentLength} characters of text content)`,
        details: { contentLength, isSpaShell: true, elapsed },
        html,
      };
    }

    if (!hasRealContent) {
      return {
        name: "Homepage content",
        passed: false,
        message: `Homepage has minimal content (${contentLength} characters)`,
        details: { contentLength, elapsed },
        html,
      };
    }

    return {
      name: "Homepage content",
      passed: true,
      message: `Homepage has ${contentLength.toLocaleString()} characters of text content`,
      details: { contentLength, elapsed },
      html,
    };
  } catch (error) {
    const elapsed = Date.now() - startTime;
    if (error instanceof Error && error.name === "TimeoutError") {
      return {
        name: "Homepage content",
        passed: false,
        message: "Homepage request timed out (10s limit)",
        timedOut: true,
        details: { elapsed },
        html: "",
      };
    }
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const isDnsError =
      errorMessage.includes("ENOTFOUND") || errorMessage.includes("EAI_AGAIN");
    return {
      name: "Homepage content",
      passed: false,
      message: isDnsError
        ? `Could not resolve domain: ${new URL(url).hostname}`
        : `Failed to fetch homepage: ${errorMessage}`,
      details: { elapsed, error: errorMessage },
      html: "",
    };
  }
}
