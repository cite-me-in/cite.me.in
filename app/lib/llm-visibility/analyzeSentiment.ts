import { generateText } from "ai";
import { z } from "zod";
import type { SentimentLabel } from "~/prisma";
import { isSameDomain } from "../isSameDomain";
import { haiku } from "./claudeClient.server";

const schema = z.object({
  label: z.enum(["positive", "negative", "neutral", "mixed"]),
  summary: z.string(),
});

export default async function analyzeSentiment({
  domain,
  queries,
}: {
  domain: string;
  queries: {
    citations: string[];
    query: string;
    text: string;
  }[];
}): Promise<{ label: SentimentLabel; summary: string }> {
  if (queries.length === 0)
    return {
      label: "neutral",
      summary: "No queries were run for this platform.",
    };

  const queryLines = queries
    .map((q) => {
      const position =
        q.citations.findIndex((c) => isSameDomain({ domain, url: c })) + 1;
      const cited =
        position !== null ? `cited at position #${position + 1}` : "not cited";
      return `Query: ${q.query}\nCitation status: ${cited}\nResponse:\n$<response>${q.text}</response>`;
    })
    .join("\n\n---\n\n");

  const { text } = await generateText({
    model: haiku,
    messages: [
      {
        role: "system" as const,
        content: `You are a brand visibility analyst. Read these AI platform responses and assess whether ${domain} is mentioned positively, negatively, neutrally, or with mixed sentiment. Also note whether it appears prominently in citations. Be concise and factual — no preamble.

Respond with a JSON object only, no markdown fences:
{"label":"positive"|"negative"|"neutral"|"mixed","summary":"2-3 sentence plain-English assessment"}`,
      },
      {
        role: "user" as const,
        content: `Domain: ${domain}\n\nResponses:\n\n${queryLines}`,
      },
    ],
  });

  try {
    const json = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
    const parsed = schema.parse(JSON.parse(json));
    return { label: parsed.label as SentimentLabel, summary: parsed.summary };
  } catch {
    return { label: "neutral", summary: "Sentiment analysis unavailable." };
  }
}
