import debug from "debug";
import OpenAI from "openai";
import { z } from "zod";
import envVars from "~/lib/envVars.server";
import { isSameDomain } from "~/lib/isSameDomain";
import type { SentimentLabel } from "~/prisma";

const logger = debug("server");

const citationRelationshipSchema = z.object({
  url: z.string(),
  relationship: z.enum(["direct", "indirect", "unrelated"]),
  reason: z.string().optional(),
});

const schema = z.object({
  label: z.enum(["positive", "negative", "neutral", "mixed"]),
  summary: z.string(),
  citations: z.array(citationRelationshipSchema).optional(),
});

const client = new OpenAI({
  apiKey: envVars.ZHIPU_API_KEY,
  baseURL: "https://api.z.ai/api/paas/v4/",
  fetch: process.env.NODE_ENV === "test" ? global.fetch : undefined,
});

export default async function analyzeSentiment({
  domain,
  queries,
  siteSummary,
}: {
  domain: string;
  queries: {
    citations: string[];
    query: string;
    text: string;
  }[];
  siteSummary?: string;
}): Promise<{
  label: SentimentLabel;
  summary: string;
  citations: z.infer<typeof citationRelationshipSchema>[];
}> {
  if (queries.length === 0)
    return {
      label: "neutral",
      summary: "No queries were run for this platform.",
      citations: [],
    };

  const allCitations = [...new Set(queries.flatMap((q) => q.citations))];

  const queryLines = queries
    .map((query) => {
      const position =
        query.citations.findIndex((url) => isSameDomain({ domain, url })) + 1;
      const cited =
        position > 0 ? `cited at position #${position}` : "not cited";
      return `Query: ${query.query}\nCitation status: ${cited}\nResponse:\n$<response>${query.text}</response>`;
    })
    .join("\n\n---\n\n");

  const completion = await client.chat.completions.create({
    model: "glm-4.7",
    messages: [
      {
        role: "system" as const,
        content: `You are a brand visibility analyst. Analyze AI platform responses for ${domain}.

${siteSummary ? `Site context: ${siteSummary}` : ""}

Tasks:
1. Assess sentiment (positive/negative/neutral/mixed) and provide a 2-3 sentence summary
2. Classify each unique citation URL by its relationship to ${domain}:
   - "direct": Same domain, subdomain, or official presence (e.g., YouTube channel, social media account)
   - "indirect": Content about the brand/person on another site (e.g., articles, reviews, forum discussions)
   - "unrelated": No clear connection to the brand

"Potentially referencing" and "likely referencing" should be treated as "unrelated".
If you see the brand name on that site, then it's "indirect".
If you don't see the brand name on that site, then it's "unrelated".

Respond with JSON only, no markdown fences:
{
  "label": "positive"|"negative"|"neutral"|"mixed",
  "summary": "2-3 sentence assessment",
  "citations": [{"url": "...", "relationship": "direct"|"indirect"|"unrelated", "reason": "brief explanation"}]
}`,
      },
      {
        role: "user" as const,
        content: `Domain: ${domain}\nUnique citations to classify:\n${allCitations.map((c) => `- ${c}`).join("\n")}\n\nResponses:\n\n${queryLines}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  try {
    const raw = completion.choices[0].message.content ?? "{}";
    const json = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
    let parsed = JSON.parse(json);

    if (parsed.answer) {
      if (typeof parsed.answer === "string") {
        try {
          parsed = JSON.parse(parsed.answer);
        } catch {
          parsed = { label: parsed.answer, summary: parsed.summary ?? "" };
        }
      } else {
        parsed = parsed.answer;
      }
    }

    const result = schema.parse(parsed);
    return {
      label: result.label as SentimentLabel,
      summary: result.summary,
      citations: result.citations ?? [],
    };
  } catch (error) {
    logger("Sentiment analysis parse error: %O", error);
    return {
      label: "neutral",
      summary: "Sentiment analysis unavailable.",
      citations: [],
    };
  }
}
