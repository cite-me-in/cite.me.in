/**
 * Spec: HTML spec — <link rel="alternate" type="text/markdown">
 * Checks that every URL advertised as a Markdown alternate actually serves
 * valid Markdown content. AI agents discover these URLs through the
 * `markdownAlternateLinks` check, then request the resource to verify it
 * returns Markdown (not HTML or an error).
 * Required: at least one alternate URL must be advertised.
 * Pass: all advertised alternate URLs return valid Markdown content.
 */

import type { CheckResult } from "~/lib/aiLegibility/types";

export default async function checkMdRoutes({
  urls,
}: {
  urls: string[];
}): Promise<Omit<CheckResult, "category">> {
  if (urls.length === 0) {
    return {
      name: ".md routes",
      passed: false,
      message:
        "No markdown alternate URLs advertised — add <link rel='alternate' type='text/markdown'> to your pages",
      details: { advertisedUrls: 0 },
    };
  }

  const results: {
    url: string;
    ok: boolean;
    contentType: string;
    contentLength: number;
    status: number;
  }[] = [];
  let allValid = true;

  for (const mdUrl of urls) {
    try {
      const response = await fetch(mdUrl, {
        headers: {
          "User-Agent": "CiteMeIn-AI-Legibility-Bot/1.0",
          Accept: "text/markdown",
        },
        signal: AbortSignal.timeout(10_000),
      });

      const contentType = response.headers.get("content-type") ?? "";
      const isMarkdown =
        contentType.includes("text/markdown") ||
        contentType.includes("text/plain");
      const text = response.ok ? await response.text() : "";
      const contentLength = text.trim().length;
      const ok = response.ok && isMarkdown && contentLength > 50;

      if (!ok) allValid = false;

      results.push({
        url: mdUrl,
        ok,
        contentType,
        contentLength,
        status: response.status,
      });
    } catch (error) {
      allValid = false;
      if (error instanceof Error && error.name === "TimeoutError") {
        results.push({
          url: mdUrl,
          ok: false,
          contentType: "",
          contentLength: 0,
          status: 0,
        });
      } else {
        results.push({
          url: mdUrl,
          ok: false,
          contentType: "",
          contentLength: 0,
          status: 0,
        });
      }
    }
  }

  const validCount = results.filter((r) => r.ok).length;

  if (allValid) {
    return {
      name: ".md routes",
      passed: true,
      message: `All ${urls.length} advertised alternate URL${urls.length === 1 ? "" : "s"} serve valid Markdown content`,
      details: { advertisedUrls: urls.length, validCount, results },
    };
  }

  const failures = results
    .filter((r) => !r.ok)
    .map(
      (r) =>
        `${r.url} (HTTP ${r.status}, Content-Type: ${r.contentType || "none"}, ${r.contentLength} chars)`,
    );

  return {
    name: ".md routes",
    passed: false,
    message: `${validCount}/${urls.length} advertised alternate URLs serve valid Markdown: ${failures.join("; ")}`,
    details: { advertisedUrls: urls.length, validCount, results },
  };
}
