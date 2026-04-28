import type { CheckResult } from "~/lib/aiLegibility/types";

export default async function checkContentSignals({
  url,
}: {
  url: string;
}): Promise<CheckResult> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "CiteMeIn-AI-Legibility-Bot/1.0",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(10_000),
    });

    const contentType = response.headers.get("Content-Type") ?? "";
    const contentSignature = response.headers.get("Content-Signature");

    if (contentSignature) {
      return {
        name: "Content Signals",
        category: "welcomed",
        passed: true,
        message:
          "Content-Signature header found — AI agents can verify content provenance",
        details: { contentType, contentSignaturePresent: true },
      };
    }

    return {
      name: "Content Signals",
      category: "welcomed",
      passed: false,
      message:
        "No Content-Signature header — AI agents cannot verify content authenticity",
      details: { contentType, contentSignaturePresent: false },
    };
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return {
        name: "Content Signals",
        category: "welcomed",
        passed: false,
        message: "Content Signals request timed out (10s limit)",
        timedOut: true,
      };
    }
    return {
      name: "Content Signals",
      category: "welcomed",
      passed: false,
      message: `Failed to check Content Signals: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
