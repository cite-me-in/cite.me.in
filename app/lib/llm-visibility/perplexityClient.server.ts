import Perplexity, { APIError as PerplexityAPIError } from "@perplexity-ai/perplexity_ai";
import envVars from "~/lib/envVars.server";
import { InsufficientCreditError } from "./insufficientCreditError";
import type { QueryFn } from "./queryFn";

export const MODEL_ID = "sonar";
export const MODEL_PRICING = { costPerInputM: 1.0, costPerOutputM: 1.0 };

const client = new Perplexity({
  apiKey: envVars.PERPLEXITY_API_KEY,
});

export default async function queryPerplexity({
  maxRetries,
  timeout,
  query,
}: {
  maxRetries: number;
  timeout: number;
  query: string;
}): ReturnType<QueryFn> {
  try {
    const response = await client.search.create(
      {
        query,
        max_tokens: 5000,
      },
      {
        maxRetries,
        timeout,
      },
    );

    const text = response.results
      .map((result) => `[${result.title}](${result.url})\n\n${result.snippet}`)
      .join("\n\n");
    const citations = response.results.map((result) => result.url).filter(Boolean);

    return {
      citations,
      extraQueries: [],
      text,
      usage: {
        inputTokens: 0,
        outputTokens: 0,
      },
    };
  } catch (error) {
    if (error instanceof PerplexityAPIError && (error.status === 402 || error.status === 429))
      throw new InsufficientCreditError("perplexity", error.status);
    throw error;
  }
}
