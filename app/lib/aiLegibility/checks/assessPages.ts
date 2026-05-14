import { map } from "radashi";
import { assessContent } from "./extractContent";

type AssessedPage = {
  url: string;
  html: string;
  headers: Headers;
  ok: boolean;
  status: number;
  timedOut: boolean;
  passed: boolean;
  message: string;
  error?: string;
};

export default async function assessPages({ urls }: { urls: string[] }): Promise<AssessedPage[]> {
  return await map(urls, async (url) => {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "CiteMeIn-AI-Legibility-Bot/1.0",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(10_000),
      });

      const html = await response.text();

      if (!response.ok)
        return {
          url,
          html,
          headers: response.headers,
          ok: false,
          status: response.status,
          timedOut: false,
          passed: false,
          message: `HTTP ${response.status}`,
        };

      const content = await assessContent(html, url);

      if (content.isSpaShell && !content.hasRealContent)
        return {
          url,
          html,
          headers: response.headers,
          ok: true,
          status: 200,
          timedOut: false,
          passed: false,
          message: `Empty SPA shell (${content.contentLength} chars)`,
        };

      if (!content.useful) {
        const signals =
          content.usefulnessSignals.length > 0 ? `: ${content.usefulnessSignals.join(", ")}` : "";
        return {
          url,
          html,
          headers: response.headers,
          ok: true,
          status: 200,
          timedOut: false,
          passed: false,
          message: `Minimal content (${content.contentLength} chars, ${content.wordCount} words)${signals}`,
        };
      }

      const details = [
        `${content.contentLength.toLocaleString()} chars`,
        `${content.wordCount} words`,
      ];
      if (content.paragraphs) details.push("paragraphs");
      if (content.sentenceEndings) details.push("sentences");
      if (content.headings) details.push("headings");

      return {
        url,
        html,
        headers: response.headers,
        ok: true,
        status: 200,
        timedOut: false,
        passed: true,
        message: details.join(", "),
      };
    } catch (error) {
      const isTimeout = error instanceof Error && error.name === "TimeoutError";
      if (isTimeout)
        return {
          url,
          html: "",
          headers: new Headers(),
          ok: false,
          status: 0,
          timedOut: true,
          passed: false,
          message: "Timed out (10s limit)",
        };

      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const isDnsError = errorMessage.includes("ENOTFOUND") || errorMessage.includes("EAI_AGAIN");
      return {
        url,
        html: "",
        headers: new Headers(),
        ok: false,
        status: 0,
        timedOut: false,
        passed: false,
        message: isDnsError
          ? `Could not resolve domain: ${new URL(url).hostname}`
          : `Failed to fetch: ${errorMessage}`,
        error: errorMessage,
      };
    }
  });
}
