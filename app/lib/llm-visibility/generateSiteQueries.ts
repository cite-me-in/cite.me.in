import { Temporal } from "@js-temporal/polyfill";
import { Output, generateText } from "ai";
import { z } from "zod";
import prisma from "~/lib/prisma.server";
import type { Site } from "~/prisma";
import { haiku } from "./anthropic";
import defaultQueryCategories from "./defaultQueryCategories";

export default async function generateSiteQueries(
  site: Site,
): Promise<{ group: string; query: string }[]> {
  const suggestions = await prisma.siteQuerySuggestion.findMany({
    where: {
      createdAt: {
        gte: Temporal.Now.instant().subtract({ hours: 24 }).toString(),
      },
      siteId: site.id,
    },
  });
  if (suggestions.length > 0) {
    return suggestions.map((suggestion) => ({
      group: suggestion.group,
      query: suggestion.query,
    }));
  }

  const { output } = await generateText({
    model: haiku,
    output: Output.array({
      element: z.object({
        group: z.string(),
        query: z.string(),
      }),
    }),
    messages: [
      {
        role: "system" as const,
        content: `You generate search queries a user might type into an AI platform (ChatGPT, Perplexity, Claude, Gemini) that should ideally return a citation to the given website.

Return exactly 9 queries: 3 per category.

Categories:
${defaultQueryCategories.map((c) => `- ${c.group}: ${c.intent}`).join("\n")}

Rules:
- Queries must sound like real user questions, not marketing copy.
- Each query should be specific enough to trigger a citation for this site.
- Vary the phrasing; do not repeat the same question structure.
- Group should be one of the following: ${defaultQueryCategories.map((c) => c.group).join(", ")}
- Group is a number followed by a dot and the group name.
`,
      },
      {
        role: "user" as const,
        content: `Website content:\n\n${site.content}`,
      },
    ],
  });

  await prisma.siteQuerySuggestion.createMany({
    data: output.map((suggestion) => ({
      siteId: site.id,
      group: suggestion.group,
      query: suggestion.query,
    })),
  });
  return output;
}
