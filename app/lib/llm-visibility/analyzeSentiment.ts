import { generateObject } from "ai";
import { z } from "zod";
import type { SentimentLabel } from "~/prisma";
import { haiku } from "./anthropic";

const schema = z.object({
  label: z.enum(["positive", "negative", "neutral", "mixed"]),
  summary: z.string(),
});

export default async function analyzeSentiment({
  domain,
  queries,
}: {
  domain: string;
  queries: { query: string; text: string; position: number | null }[];
}): Promise<{ label: SentimentLabel; summary: string }> {
  const queryLines = queries
    .map((q) => {
      const cited =
        q.position !== null
          ? `cited at position #${q.position + 1}`
          : "not cited";
      return `Query: ${q.query}\nCitation status: ${cited}\nResponse:\n${q.text}`;
    })
    .join("\n\n---\n\n");

  const { object } = await generateObject({
    model: haiku,
    schema,
    messages: [
      {
        role: "system" as const,
        content: `You are a brand visibility analyst. Read these AI platform responses and assess whether ${domain} is mentioned positively, negatively, neutrally, or with mixed sentiment. Also note whether it appears prominently in citations. Be concise and factual — no preamble.`,
      },
      {
        role: "user" as const,
        content: `Domain: ${domain}\n\nResponses:\n\n${queryLines}`,
      },
    ],
  });

  return object;
}
