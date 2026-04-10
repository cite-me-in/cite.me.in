import { createAnthropic } from "@ai-sdk/anthropic";
import { Output, generateText } from "ai";
import { z } from "zod";
import prisma from "~/lib/prisma.server";
import envVars from "../envVars.server";
import queryGroups from "./queryGroups";

const anthropic = createAnthropic({
  apiKey: envVars.ANTHROPIC_API_KEY,
});

const model = anthropic("claude-haiku-4-5");

/**
 * Generate site queries for a given site. Use the content from the database if
 * available.
 *
 * @param site - The site to generate queries for.
 * @returns The generated queries.
 */
export default async function generateSiteQueries(site: {
  id: string;
  domain: string;
}): Promise<{ group: string; query: string; }[]> {
  const { content } = await prisma.site.findUniqueOrThrow({
    where: { id: site.id },
    select: { content: true },
  });
  const { output } = await generateText({
    model: model,
    output: Output.array({
      element: z.object({
        group: z.string(),
        query: z.string(),
      }),
    }),
    messages: [
      {
        role: "system" as const,
        content: `You generate search queries a user might type into an AI platform (ChatGPT, Copilot, Claude, Gemini) that should ideally return a citation to the given website.

Return exactly 9 queries: 3 per group.

Groups:
${queryGroups.map((g) => `- ${g.group}: ${g.intent}`).join("\n")}

Rules:
- Queries must sound like real user questions, not marketing copy.
- Each query should be specific enough to trigger a citation for this site.
- Vary the phrasing; do not repeat the same question structure.
- Group should be one of the following: ${queryGroups.map((c) => c.group).join(", ")}
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
