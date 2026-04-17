import OpenAI from "openai";
import envVars from "~/lib/envVars.server";
import type { QueryFn } from "./queryFn";

export const MODEL_ID = "gpt-5-chat-latest";
export const MODEL_PRICING = { costPerInputM: 1.25, costPerOutputM: 10.0 };

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
      model: MODEL_ID,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: `You are ChatGPT with web search capabilities. When answering questions, search
the web for current information and cite your sources using numbered citations
like [1], [2], etc. Always include a 'Sources:' section at the end with numbered
references, with a link to each source URL.`,
            },
          ],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: query }],
        },
      ],
      tools: [{ type: "web_search" }],
      tool_choice: "auto",
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
