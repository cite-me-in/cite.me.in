import { anthropic } from "@ai-sdk/anthropic";
import { Output, generateText } from "ai";
import { invariant } from "es-toolkit";
import { z } from "zod";
import envVars from "~/lib/envVars";
import prisma from "~/lib/prisma.server";

export const CATEGORIES = [
  {
    group: "1.discovery",
    intent: "User doesn't know your brand; looking for solutions in your space",
  },
  {
    group: "2.active_search",
    intent: "User is actively looking for a specific product/service you offer",
  },
  {
    group: "3.comparison",
    intent:
      "User is comparing options; your site should appear as a credible choice",
  },
] as const;

export default async function generateSiteQueries(
  content: string,
): Promise<{ group: string; query: string }[]> {
  invariant(envVars.ANTHROPIC_API_KEY, "ANTHROPIC_API_KEY is not set");
  const { output } = await generateText({
    model: anthropic("claude-haiku-4-5-20251001"),
    output: Output.array({
      element: z.object({
        group: z.enum(["1.discovery", "2.active_search", "3.comparison"]),
        query: z.string().min(10).max(200),
      }),
    }),
    messages: [
      {
        role: "system" as const,
        content: `You generate search queries a user might type into an AI platform (ChatGPT, Perplexity, Claude, Gemini) that should ideally return a citation to the given website.

Return exactly 9 queries: 3 per category.

Categories:
${CATEGORIES.map((c) => `- ${c.group}: ${c.intent}`).join("\n")}

Rules:
- Queries must sound like real user questions, not marketing copy.
- Each query should be specific enough to trigger a citation for this site.
- Vary the phrasing; do not repeat the same question structure.`,
      },
      {
        role: "user" as const,
        content: `Website content:\n\n${content}`,
      },
    ],
  });
  return output;
}

if (import.meta.main) {
  const site = await prisma.site.findFirstOrThrow({
    where: { domain: "rentail.space" },
  });
  invariant(site.content, "Site content is not set");
  const queries = await generateSiteQueries(site.content);
  console.log(JSON.stringify(queries, null, 2));
}
