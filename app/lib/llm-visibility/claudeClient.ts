import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { haiku } from "./anthropic";
import type { QueryFn } from "./queryFn";

export default async function queryClaude(query: string): ReturnType<QueryFn> {
  const { sources, text, usage } = await generateText({
    model: haiku,
    prompt: [
      {
        role: "system",
        content: `
You are Claude with web search capabilities. When answering questions, search
the web for current information and cite your sources using numbered citations
like [1], [2], etc. Always include a 'Sources:' section at the end with numbered
references.`,
      },
      {
        role: "user",
        content: [{ text: query, type: "text" }],
      },
    ],
    maxOutputTokens: 2000,
    tools: {
      web_search: anthropic.tools.webSearch_20250305({}),
    },
    toolChoice: { type: "tool", toolName: "web_search" },
    maxRetries: import.meta.env.PROD ? 2 : 0,
  });
  const citations = sources
    .filter((source) => source.sourceType === "url")
    .map((source) => source.url);
  return { citations, extraQueries: [], text, usage };
}
