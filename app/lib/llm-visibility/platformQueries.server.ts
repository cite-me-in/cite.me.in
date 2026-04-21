import queryClaude from "~/lib/llm-visibility/claudeClient.server";
import queryGemini from "~/lib/llm-visibility/geminiClient.server";
import openaiClient from "~/lib/llm-visibility/openaiClient.server";
import PLATFORMS from "~/lib/llm-visibility/platforms";
import type { QueryFn } from "./queryFn";

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
  //{ ...platforms.perplexity, queryFn: queryPerplexity },
  //{ ...platforms.copilot, queryFn: ({ query, timeout }) => fetchSERPResults({ query, engine: "bing_copilot", timeout }), },
] satisfies {
  name: string;
  model: string;
  queryFn: QueryFn;
  label: string;
}[];
