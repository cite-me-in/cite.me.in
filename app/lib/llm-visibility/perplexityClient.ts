import { createPerplexity } from "@ai-sdk/perplexity";
import { generateText } from "ai";
import { invariant } from "es-toolkit";
import envVars from "~/lib/envVars";
import type { QueryFn } from "./queryFn";

const MODEL_ID = "sonar";

export default async function queryPerplexity(
  query: string,
): ReturnType<QueryFn> {
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
    maxOutputTokens: 2000,
    maxRetries: import.meta.env.PROD ? 2 : 0,
  });
  const citations = sources
    .filter((source) => source.sourceType === "url")
    .map((source) => source.url);

  return { citations, extraQueries: [], text, usage };
}
