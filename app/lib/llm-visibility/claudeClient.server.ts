import { anthropic, createAnthropic } from "@ai-sdk/anthropic";
import * as ai from "ai";
import { wrapAISDK } from "braintrust";
import envVars from "~/lib/envVars.server";
import type { QueryFn } from "./queryFn";

export const MODEL_ID = "claude-haiku-4-5-20251001";
export const MODEL_PRICING = { costPerInputM: 1.0, costPerOutputM: 5.0 };

const { generateText } = wrapAISDK(ai);

export default async function queryClaude({
  maxRetries,
  timeout,
  query,
}: {
  maxRetries: number;
  timeout: number;
  query: string;
}): ReturnType<QueryFn> {
  const { sources, text, usage } = await generateText({
    model: createAnthropic({ apiKey: envVars.ANTHROPIC_API_KEY, })("claude-haiku-4-5"),
    prompt: [
      {
        role: "system",
        content: `
You are Claude with web search capabilities. When answering questions, search
the web for current information and cite your sources using numbered citations
like [1], [2], etc. Always include a 'Sources:' section at the end with numbered
references, with a link to each source URL.`,
      },
      {
        role: "user",
        content: [{ text: query, type: "text" }],
      },
    ],
    tools: {
      web_search: anthropic.tools.webSearch_20250305({}),
    },
    toolChoice: { type: "tool", toolName: "web_search" },

    maxOutputTokens: 5000,
    maxRetries,
    timeout,
  });
  const urlSources = sources.filter(
    (source) =>
      source.type === "source" &&
      source.sourceType === "url" &&
      source.providerMetadata?.anthropic?.citedText &&
      source.url,
  ) as { url: string; }[];
  const citations = [...new Set(urlSources.map(({ url }) => url))];

  return { citations, extraQueries: [], text, usage };
}
