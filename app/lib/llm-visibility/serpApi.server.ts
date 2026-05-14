import invariant from "tiny-invariant";
import envVars from "~/lib/envVars.server";
import { InsufficientCreditError } from "./insufficientCreditError";

export const SERPAPI_PRICING = 25.0 / 1000;

/**
 * Uses the SerpAPI to fetch organic results for a given query and engine.
 *
 * @see https://serpapi.com/bing-copilot-api
 * @see https://serpapi.com/bing-search-api
 * @see https://serpapi.com/google-ai-mode-api
 * @see https://serpapi.com/search-api
 */
export default async function fetchSERPResults({
  query,
  engine,
  timeout,
}: {
  timeout: number;
  query: string;
  engine: "google" | "bing" | "bing_copilot" | "google_ai_mode";
}): Promise<{
  citations: string[];
  extraQueries: string[];
  text: string;
  usage: { inputTokens: number; outputTokens: number };
}> {
  invariant(envVars.SERPAPI_API_KEY, "SERPAPI_API_KEY is not set");
  const url = new URL("https://serpapi.com/search");
  url.searchParams.set("q", query);
  url.searchParams.set("engine", engine);
  url.searchParams.set("api_key", envVars.SERPAPI_API_KEY);

  const response = await fetch(url, { signal: AbortSignal.timeout(timeout) });
  if (response.status === 402 || response.status === 429)
    throw new InsufficientCreditError(
      engine === "bing_copilot" ? "copilot" : engine,
      response.status,
    );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SerpApi error ${response.status}: ${text}`);
  }
  const json = (await response.json()) as {
    organic_results?: {
      link: string;
      title: string;
    }[];
    related_searches?: {
      query: string;
      link: string;
    }[];
    text_blocks?: TextBlock[];
    references?: {
      title: string;
      link: string;
    }[];
    related_questions?: { question: string }[];
    reconstructed_markdown?: string;
  };
  const citations =
    json.references?.map(({ link }) => link) ?? json.organic_results?.map(({ link }) => link) ?? [];
  const extraQueries = json.related_searches?.map((r) => r.query) ?? [];
  const text = json.reconstructed_markdown ?? combineTextBlocks(json.text_blocks ?? []);
  return {
    citations,
    extraQueries,
    text,
    usage: { inputTokens: 0, outputTokens: 0 },
  };
}

type TextBlock =
  | {
      type: "heading";
      snippet: string;
      level: number;
    }
  | {
      type: "paragraph";
      snippet: string;
    }
  | {
      type: "list";
      list: {
        snippet: string;
      }[];
    };

function combineTextBlocks(textBlocks: TextBlock[]): string {
  return textBlocks
    .map((block) =>
      block.type === "heading"
        ? `${"#".repeat(block.level)} ${block.snippet}`
        : block.type === "paragraph"
          ? block.snippet
          : block.type === "list"
            ? `${block.list.map((item) => `- ${item.snippet}`).join("\n")}`
            : "",
    )
    .join("\n");
}
