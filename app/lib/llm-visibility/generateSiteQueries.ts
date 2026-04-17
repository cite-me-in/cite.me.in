import { Anthropic } from "@anthropic-ai/sdk";
import z from "zod";
import envVars from "~/lib/envVars.server";
import prisma from "~/lib/prisma.server";
import queryGroups from "./queryGroups";

const client = new Anthropic({
  apiKey: envVars.ANTHROPIC_API_KEY,
});

/**
 * Generate site queries for a given site. Use the content from the database if
 * available.
 *
 * @param site - The site to generate queries for.
 * @returns The generated queries.
 */
export default async function generateSiteQueries(
  siteId: string,
): Promise<{ group: string; query: string }[]> {
  const site = await prisma.site.findUniqueOrThrow({
    where: { id: siteId },
    select: { content: true },
  });
  const { content, ...x } = await client.beta.messages.create({
    model: "claude-haiku-4-5",
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "array",
          items: {
            type: "object",
            properties: {
              group: { type: "string" },
              query: { type: "string" },
            },
            required: ["group", "query"],
            additionalProperties: false,
          },
        },
      },
    },
    system: `You generate search queries a user might type into an AI platform (ChatGPT, Copilot, Claude, Gemini) that should ideally return a citation to the given website.

Return exactly 9 queries: 3 per group.

Groups:
${queryGroups.map((g) => `- ${g.group}: ${g.intent}`).join("\n")}

Rules:
- Queries must sound like real user questions, not marketing copy.
- Each query should be specific enough to trigger a citation for this site.
- Vary the phrasing; do not repeat the same question structure.
- Group should be one of the following: ${queryGroups.map((c) => c.group).join(", ")}
- Group is a number followed by a dot and the group name.`,
    messages: [
      {
        role: "user",
        content: [
          { text: `Website content:\n\n${site.content}`, type: "text" },
        ],
      },
    ],
    max_tokens: 5_000,
  });

  const text = content.filter((c) => c.type === "text")[0].text;
  const json = z
    .array(z.object({ group: z.string(), query: z.string() }))
    .parse(JSON.parse(text));

  const suggestions = await prisma.siteQuerySuggestion.createManyAndReturn({
    data: json.map(({ group, query }) => ({ siteId, group, query })),
  });
  return suggestions;
}
