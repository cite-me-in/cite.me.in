import queryClaude from "~/lib/llm-visibility/claudeClient.server";
import queryGemini from "~/lib/llm-visibility/geminiClient";
import openaiClient from "~/lib/llm-visibility/openaiClient";
import queryPerplexity from "~/lib/llm-visibility/perplexityClient";
import PLATFORMS from "~/lib/llm-visibility/platforms";
import type { QueryFn } from "./queryFn";

const platforms = Object.fromEntries(
  PLATFORMS.map(({ name, modelId, label }) => [name, { name, modelId, label }]),
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
] satisfies {
  name: string;
  modelId: string;
  queryFn: QueryFn;
  label: string;
}[];
