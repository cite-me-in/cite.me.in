import queryClaude from "~/lib/llm-visibility/claudeClient.server";
import queryGemini from "~/lib/llm-visibility/geminiClient";
import openaiClient from "~/lib/llm-visibility/openaiClient";
import queryPerplexity from "~/lib/llm-visibility/perplexityClient";
import PLATFORMS from "~/lib/llm-visibility/platforms";
import type { QueryFn } from "./queryFn";
import fetchSERPResults from "./serpApi.server";

const platforms = Object.fromEntries(
  PLATFORMS.map(({ name, model, label }) => [name, { name, model, label }]),
);

/**
 * NOTE: This is a .server file that can only be used in loader/action
 * files, where we can call query functions. This is because the query
 * functions are not available in the client.
 */
export default [
  { ...platforms.chatgpt, queryFn: openaiClient },
  { ...platforms.claude, queryFn: queryClaude },
  { ...platforms.gemini, queryFn: queryGemini },
  { ...platforms.perplexity, queryFn: queryPerplexity },
  {
    ...platforms.bing,
    queryFn: ({ query, timeout }) =>
      fetchSERPResults({ query, engine: "bing", timeout }),
  },
  {
    ...platforms.google,
    queryFn: ({ query, timeout }) =>
      fetchSERPResults({ query, engine: "google", timeout }),
  },
  {
    ...platforms.copilot,
    queryFn: ({ query, timeout }) =>
      fetchSERPResults({ query, engine: "bing_copilot", timeout }),
  },
  {
    ...platforms["google-ai-mode"],
    queryFn: ({ query, timeout }) =>
      fetchSERPResults({ query, engine: "google_ai_mode", timeout }),
  },
] satisfies {
  name: string;
  model: string;
  queryFn: QueryFn;
  label: string;
}[];
