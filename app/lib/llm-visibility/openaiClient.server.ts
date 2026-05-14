import OpenAI from "openai";
import envVars from "~/lib/envVars.server";
import { InsufficientCreditError } from "./insufficientCreditError";
import type { QueryFn } from "./queryFn";

// https://developers.openai.com/api/docs/pricing
export const MODEL_ID = "gpt-4o-mini";
export const MODEL_PRICING = { costPerInputM: 0.4, costPerOutputM: 1.6 };

const client = new OpenAI({
  apiKey: envVars.OPENAI_API_KEY,
});

export default async function openaiClient({
  maxRetries,
  query,
  timeout,
}: {
  maxRetries: number;
  query: string;
  timeout: number;
}): ReturnType<QueryFn> {
  let output, usage;
  try {
    ({ output, usage } = await client.responses.create(
      {
        input: query,
        model: MODEL_ID,
        tools: [{ type: "web_search" }],
      },
      {
        maxRetries,
        timeout,
      },
    ));
  } catch (error) {
    if (
      error instanceof OpenAI.APIError &&
      (error.status === 402 || error.status === 429 || error.code === "insufficient_quota")
    )
      throw new InsufficientCreditError("chatgpt", error.status);
    throw error;
  }

  const message = output.find((item) => item.type === "message");
  const text =
    message?.type === "message" && message.content[0]?.type === "output_text"
      ? message.content[0].text
      : "";

  const annotations =
    message?.type === "message" && message.content[0]?.type === "output_text"
      ? (message.content[0].annotations ?? [])
      : [];
  const citations = [
    ...new Set(
      annotations.filter((a) => a.type === "url_citation").map((a) => (a as { url: string }).url),
    ),
  ];

  return {
    citations,
    extraQueries: [],
    text,
    usage: {
      inputTokens: usage?.input_tokens ?? 0,
      outputTokens: usage?.output_tokens ?? 0,
    },
  };
}
