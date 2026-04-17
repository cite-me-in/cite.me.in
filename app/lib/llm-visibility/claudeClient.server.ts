import Anthropic from "@anthropic-ai/sdk";
import type { BetaWebSearchResultBlock } from "@anthropic-ai/sdk/resources/beta/messages/messages.mjs";
import envVars from "~/lib/envVars.server";
import type { QueryFn } from "./queryFn";

export const MODEL_ID = "claude-haiku-4-5-20251001";
export const MODEL_PRICING = { costPerInputM: 1.0, costPerOutputM: 5.0 };

const client = new Anthropic({
  apiKey: envVars.ANTHROPIC_API_KEY,
});

export default async function queryClaude({
  timeout,
  query,
}: {
  maxRetries: number;
  timeout: number;
  query: string;
}): ReturnType<QueryFn> {
  const { content, usage } = await client.beta.messages.create(
    {
      model: "claude-haiku-4-5",
      system: `
You are Claude with web search capabilities. When answering questions, search
the web for current information and cite your sources using numbered citations
like [1], [2], etc. Always include a 'Sources:' section at the end with numbered
references, with a link to each source URL.`,
      messages: [
        {
          content: [{ text: query, type: "text" }],
          role: "user",
        },
      ],
      tools: [
        {
          name: "web_search",
          type: "web_search_20260209",
          allowed_callers: ["direct"],
        },
      ],
      tool_choice: { type: "tool", name: "web_search" },
      max_tokens: 5000,
    },
    { timeout },
  );

  const text = content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .filter(Boolean)
    .join("\n");

  const sources = content.filter((c) => c.type === "web_search_tool_result")[0]
    .content as BetaWebSearchResultBlock[];
  const urlSources = sources.filter((source) => source.url);
  const citations = [...new Set(urlSources.map(({ url }) => url))];

  return {
    citations,
    extraQueries: [],
    text,
    usage: {
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
    },
  };
}
