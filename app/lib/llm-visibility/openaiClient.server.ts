import OpenAI from "openai";
import envVars from "~/lib/envVars.server";
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
  const { output, usage } = await client.responses.create(
    {
      input: query,
      model: MODEL_ID,
      tools: [{ type: "web_search" }],
    },
    {
      maxRetries,
      timeout,
    },
  );

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
      annotations
        .filter((a) => a.type === "url_citation")
        .map((a) => (a as { url: string }).url),
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
