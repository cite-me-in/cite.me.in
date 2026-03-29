import { openai } from "@ai-sdk/openai";
import * as ai from "ai";
import { wrapAISDK } from "braintrust";
import invariant from "tiny-invariant";
import envVars from "~/lib/envVars";
import type { QueryFn } from "./queryFn";

export const MODEL_ID = "gpt-5-chat-latest";
export const MODEL_PRICING = { costPerInputM: 1.25, costPerOutputM: 10.0 };

const { generateText } = wrapAISDK(ai);

export default async function openaiClient({
  maxRetries,
  query,
  timeout,
}: {
  maxRetries: number;
  query: string;
  timeout: number;
}): ReturnType<QueryFn> {
  invariant(envVars.OPENAI_API_KEY, "OPENAI_API_KEY is not set");

  const { sources, text, usage } = await generateText({
    model: openai(MODEL_ID),
    providerOptions: {
      openai: {
        apiKey: envVars.OPENAI_API_KEY,
      },
    },

    prompt: [
      {
        role: "system",
        content: `
You are ChatGPT with web search capabilities. When answering questions, search
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
      web_search: openai.tools.webSearch({
        externalWebAccess: true,
        searchContextSize: "high",
      }),
    },
    toolChoice: { type: "tool", toolName: "web_search" },

    maxOutputTokens: 5000,
    maxRetries,
    timeout,
  });
  const urlSources = sources.filter(
    (source) =>
      source.type === "source" && source.sourceType === "url" && source.url,
  ) as { url: string }[];
  const citations = [...new Set(urlSources.map(({ url }) => url))];
  return { citations, extraQueries: [], text, usage };
}
