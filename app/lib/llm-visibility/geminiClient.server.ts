import { GoogleGenAI, ApiError as GoogleApiError } from "@google/genai";
import { ms } from "convert";
import { map } from "radashi";
import envVars from "~/lib/envVars.server";
import { InsufficientCreditError } from "./insufficientCreditError";
import type { QueryFn } from "./queryFn";

// https://ai.google.dev/gemini-api/docs/pricing
export const MODEL_ID = "gemini-2.5-flash";
export const MODEL_PRICING = { costPerInputM: 0.3, costPerOutputM: 2.5 };

const client = new GoogleGenAI({
  apiKey: envVars.GOOGLE_GENERATIVE_AI_API_KEY,
});

interface GroundingMetadata {
  webSearchQueries?: string[];
  groundingChunks?: { web: { uri: string; title: string } }[];
  groundingSupports?: {
    segment: { startIndex: number; endIndex: number; text: string };
    groundingChunkIndices: number[];
  }[];
}

export default async function queryGemini({
  timeout,
  query,
}: {
  maxRetries: number;
  timeout: number;
  query: string;
}): ReturnType<QueryFn> {
  let response;
  try {
    response = await client.models.generateContent({
      model: MODEL_ID,
      contents: [
        {
          role: "user",
          parts: [{ text: query }],
        },
      ],
      config: {
        systemInstruction: `You are Gemini with web search capabilities. When answering questions, search
the web for current information and cite your sources using numbered citations
like [1], [2], etc. Always include a 'Sources:' section at the end with numbered
references, with a link to each source URL.`,
        tools: [{ googleSearch: {} }],
        maxOutputTokens: 5000,
        httpOptions: { timeout },
      },
    });
  } catch (error) {
    if (
      error instanceof GoogleApiError &&
      (error.status === 402 || error.status === 429)
    )
      throw new InsufficientCreditError("gemini", error.status);
    throw error;
  }

  const text = response.text ?? "";
  const metadata = response.candidates?.[0]?.groundingMetadata as
    | GroundingMetadata
    | undefined;

  const extraQueries = metadata?.webSearchQueries ?? [];
  const chunks = metadata?.groundingChunks ?? [];

  const signal = AbortSignal.timeout(ms("10s"));
  const resolvedUrls = await map(chunks, async (chunk) => {
    try {
      const resp = await fetch(chunk.web.uri, {
        redirect: "follow",
        signal,
      });
      return { url: resp.url, title: chunk.web.title };
    } catch {
      return null;
    }
  });

  const validUrls = resolvedUrls.filter(
    (r): r is { url: string; title: string } => r !== null,
  );

  const citations = [...new Set(validUrls.map((r) => r.url))];

  const markdownText = addMarkdownCitations(text, validUrls);

  return {
    citations,
    extraQueries,
    text: markdownText,
    usage: {
      inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
    },
  };
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
