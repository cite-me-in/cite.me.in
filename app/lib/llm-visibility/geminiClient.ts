import { google } from "@ai-sdk/google";
import * as ai from "ai";
import { wrapAISDK } from "braintrust";
import { ms } from "convert";
import invariant from "tiny-invariant";
import { map } from "radashi";
import envVars from "~/lib/envVars";
import type { QueryFn } from "./queryFn";

export const MODEL_ID = "gemini-2.5-flash";
export const MODEL_PRICING = { costPerInputM: 0.3, costPerOutputM: 2.5 };

const { generateText } = wrapAISDK(ai);

export default async function queryGemini({
  maxRetries,
  timeout,
  query,
}: {
  maxRetries: number;
  timeout: number;
  query: string;
}): ReturnType<QueryFn> {
  invariant(
    envVars.GOOGLE_GENERATIVE_AI_API_KEY,
    "GOOGLE_GENERATIVE_AI_API_KEY is not set",
  );

  const { providerMetadata, text, usage } = await generateText({
    model: google(MODEL_ID),

    prompt: [
      {
        role: "system",
        content: `
You are Gemini with web search capabilities. When answering questions, search
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
      web_search: google.tools.googleSearch({}),
    },
    toolChoice: { type: "tool", toolName: "web_search" },

    maxOutputTokens: 5000,
    maxRetries,
    timeout,
  });

  const metadata = providerMetadata?.google.groundingMetadata as {
    webSearchQueries?: string[];
    groundingChunks?: { web: { uri: string; title: string } }[];
  };

  const extraQueries = metadata?.webSearchQueries ?? [];
  const urls = metadata?.groundingChunks?.map((chunk) => chunk.web.uri);
  const signal = AbortSignal.timeout(ms("10s"));
  const urlSources = await map(urls ?? [], async (url) => {
    try {
      const response = await fetch(url, { redirect: "follow", signal });
      return response.url;
    } catch {
      return null;
    }
  });
  const citations = [...new Set(urlSources.filter((url) => url !== null))];

  return { citations, extraQueries, text, usage };
}
