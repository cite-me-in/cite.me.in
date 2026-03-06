import { Output, generateText } from "ai";
import { z } from "zod";
import prisma from "~/lib/prisma.server";
import type { Site } from "~/prisma";
import { fetchPageContent } from "../sites.server";
import { haiku } from "./anthropic";
import defaultQueryGroups from "./defaultQueryCategories";

/**
 * Generate site queries for a given site. If the site content is not available,
 * uses the content from the database. If the generated queries are not valid,
 * throws an error.
 *
 * @param site - The site to generate queries for.
 * @returns The generated queries.
 * @throws {Error} If the site content is not available and the database content is not available.
 * @throws {Error} If the generated queries are not valid.
 */
export default async function generateSiteQueries(
  site: Site,
): Promise<{ group: string; query: string }[]> {
  const content = await fetchPageContent(site.domain);
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

Return exactly 9 queries: 3 per group.

Groups:
${defaultQueryGroups.map((g) => `- ${g.group}: ${g.intent}`).join("\n")}

Rules:
- Queries must sound like real user questions, not marketing copy.
- Each query should be specific enough to trigger a citation for this site.
- Vary the phrasing; do not repeat the same question structure.
- Group should be one of the following: ${defaultQueryGroups.map((c) => c.group).join(", ")}
- Group is a number followed by a dot and the group name.
`,
      },
      {
        role: "user" as const,
        content: `Website content:\n\n${content}`,
      },
    ],
  });

  const suggestions = await prisma.siteQuerySuggestion.createManyAndReturn({
    data: output.map(({ group, query }) => ({
      siteId: site.id,
      group,
      query,
    })),
  });
  return suggestions;
}
