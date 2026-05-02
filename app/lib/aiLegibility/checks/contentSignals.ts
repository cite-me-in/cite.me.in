/**
 * Spec: Content-Signal (content-signature.org)
 * Format in robots.txt: Content-Signal: key=value[, key=value]*
 * Valid keys: search, ai-input, ai-train
 * Valid values: yes, no
 *
 * search=yes: content may appear in AI search results
 * ai-input=yes: content may be used as AI training input
 * ai-train=no: content must not be used for model training
 */

import type { CheckResult } from "~/lib/aiLegibility/types";

const VALID_KEYS = ["search", "ai-input", "ai-train"] as const;
const VALID_VALUES = ["yes", "no"] as const;

export default async function checkContentSignals({
  url,
  robotsContent,
}: {
  url: string;
  robotsContent?: string;
}): Promise<Omit<CheckResult, "category">> {
  const robotsUrl = new URL("/robots.txt", url).href;

  try {
    const content =
      robotsContent ??
      (await (async () => {
        const response = await fetch(robotsUrl, {
          headers: {
            "User-Agent": "CiteMeIn-AI-Legibility-Bot/1.0",
            Accept: "text/plain",
          },
          signal: AbortSignal.timeout(10_000),
        });
        return response.ok ? await response.text() : null;
      })());

    if (content === null) {
      return {
        name: "Content Signals",
        passed: false,
        message: `Could not check Content-Signal — robots.txt returned HTTP 404`,
        details: { statusCode: 404 },
      };
    }
    const signalLines = content
      .split("\n")
      .filter((line) => /^Content-Signal\s*:/i.test(line.trim()));

    if (signalLines.length === 0) {
      return {
        name: "Content Signals",
        passed: false,
        message:
          "No Content-Signal found in robots.txt — AI agents lack a content usage signal",
        details: { signals: [] },
      };
    }

    const parsedSignals: {
      key: string;
      value: string;
      valid: boolean;
      error?: string;
    }[] = [];

    for (const line of signalLines) {
      const valuePart = line.replace(/^Content-Signal\s*:\s*/i, "").trim();
      const pairs = valuePart.split(",").map((p) => p.trim());

      for (const pair of pairs) {
        const [key, value] = pair.split("=").map((s) => s.trim().toLowerCase());
        if (!key || value === undefined) {
          parsedSignals.push({
            key: key || pair,
            value: value ?? "",
            valid: false,
            error: "Malformed key=value pair",
          });
          continue;
        }

        if (!(VALID_KEYS as readonly string[]).includes(key)) {
          parsedSignals.push({
            key,
            value,
            valid: false,
            error: `Unknown key "${key}" (valid: ${VALID_KEYS.join(", ")})`,
          });
          continue;
        }

        if (!(VALID_VALUES as readonly string[]).includes(value)) {
          parsedSignals.push({
            key,
            value,
            valid: false,
            error: `Invalid value "${value}" for "${key}" (must be yes or no)`,
          });
          continue;
        }

        parsedSignals.push({ key, value, valid: true });
      }
    }

    const validSignals = parsedSignals.filter((s) => s.valid);
    const invalidSignals = parsedSignals.filter((s) => !s.valid);

    const passed = validSignals.length > 0;
    const message = passed
      ? `Content-Signal found with ${validSignals.length} valid directive${validSignals.length === 1 ? "" : "s"}: ${validSignals.map((s) => `${s.key}=${s.value}`).join(", ")}${invalidSignals.length > 0 ? `. Warnings: ${invalidSignals.map((s) => s.error).join("; ")}` : ""}`
      : `Content-Signal found but all directives invalid: ${invalidSignals.map((s) => s.error).join("; ")}`;

    return {
      name: "Content Signals",
      passed,
      message,
      details: {
        raw: signalLines,
        signals: parsedSignals,
      },
    };
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return {
        name: "Content Signals",
        passed: false,
        message: "Content-Signal check timed out (10s limit)",
        timedOut: true,
      };
    }
    return {
      name: "Content Signals",
      passed: false,
      message: `Failed to check Content-Signal: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
