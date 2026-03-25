import { createPerplexity } from "@ai-sdk/perplexity";
import * as ai from "ai";
import { wrapAISDK } from "braintrust";
import { invariant } from "es-toolkit";
import envVars from "~/lib/envVars";
import type { QueryFn } from "./queryFn";

export const MODEL_ID = "sonar";
export const MODEL_PRICING = { costPerInputM: 1.0, costPerOutputM: 1.0 };

const { generateText } = wrapAISDK(ai);

export default async function queryPerplexity({
  maxRetries,
  timeout,
  query,
}: {
  maxRetries: number;
  timeout: number;
  query: string;
}): ReturnType<QueryFn> {
  invariant(envVars.PERPLEXITY_API_KEY, "PERPLEXITY_API_KEY is not set");

  const perplexity = createPerplexity({
    apiKey: envVars.PERPLEXITY_API_KEY,
  });

  const { sources, text, usage } = await generateText({
    model: perplexity(MODEL_ID),

    prompt: [
      {
        role: "system",
        content: `
You are Perplexity with web search capabilities. When answering questions,
search the web for current information and cite your sources using numbered
citations like [1], [2], etc. Always include a 'Sources:' section at the end
with numbered references.`,
      },
      {
        role: "user",
        content: [{ text: query, type: "text" }],
      },
    ],

    maxOutputTokens: 5000,
    maxRetries,
    timeout,
  });
  const souceURLs = sources.filter(
    (source) =>
      source.type === "source" && source.sourceType === "url" && source.url,
  ) as { url: string }[];
  const citations = [...new Set(souceURLs.map(({ url }) => url))];
  return { citations, extraQueries: [], text, usage };
}
