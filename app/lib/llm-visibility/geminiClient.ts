import { google } from "@ai-sdk/google";
import * as ai from "ai";
import { wrapAISDK } from "braintrust";
import { ms } from "convert";
import { map } from "radashi";
import invariant from "tiny-invariant";
import envVars from "~/lib/envVars.server";
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
    groundingSupports?: {
      segment: { startIndex: number; endIndex: number; text: string };
      groundingChunkIndices: number[];
    }[];
  };

  const extraQueries = metadata?.webSearchQueries ?? [];
  const chunks = metadata?.groundingChunks ?? [];

  const signal = AbortSignal.timeout(ms("10s"));
  const resolvedUrls = await map(chunks, async (chunk) => {
    try {
      const response = await fetch(chunk.web.uri, {
        redirect: "follow",
        signal,
      });
      return { url: response.url, title: chunk.web.title };
    } catch {
      return null;
    }
  });

  const citations = [
    ...new Set(resolvedUrls.filter(Boolean).map((r) => r!.url)),
  ];

  const markdownText = addMarkdownCitations(
    text,
    resolvedUrls.filter(Boolean) as { url: string; title: string }[],
  );

  return { citations, extraQueries, text: markdownText, usage };
}

function addMarkdownCitations(
  text: string,
  sources: { url: string; title: string }[],
): string {
  const sourcesIndex = text.indexOf("\nSources:\n");
  if (sourcesIndex === -1 || sources.length === 0) return text;

  const mainText = text.slice(0, sourcesIndex);
  const markdownSources = sources
    .map((s, i) => `${i + 1}. [${s.title || s.url}](${s.url})`)
    .join("\n");

  return `${mainText}\n\n## Sources\n\n${markdownSources}\n`;
}
