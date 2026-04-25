import { z } from "zod";
import { verifyBearerToken } from "~/lib/mcp/auth";
import prisma from "~/lib/prisma.server";

export default {
  name: "list_sites",
  description: "List all your sites",
  inputSchema: z.object({}),
  outputSchema: z.object({
    sites: z
      .array(
        z.object({
          id: z.string(),
          domain: z.string(),
          summary: z.string(),
          createdAt: z.string(),
        }),
      )
      .describe("List of sites you have access to"),
  }),
  handler: async (_: unknown, extra: { authInfo?: { token?: string } }) => {
    try {
      const userId = await verifyBearerToken(extra.authInfo?.token);
      const sites = await prisma.site.findMany({
        where: {
          OR: [{ ownerId: userId }, { siteUsers: { some: { userId } } }],
        },
        select: {
          id: true,
          domain: true,
          summary: true,
          createdAt: true,
        },
        orderBy: { domain: "asc" },
      });

      const structuredContent = {
        sites: sites.map((s) => ({
          id: s.id,
          domain: s.domain,
          summary: s.summary,
          createdAt: s.createdAt.toISOString(),
        })),
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(structuredContent, null, 2),
          },
        ],
        structuredContent,
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        structuredContent: { sites: [] },
        isError: true,
      };
    }
  },
};
