import { z } from "zod";
import { verifyBearerToken } from "~/lib/mcp/auth";
import prisma from "~/lib/prisma.server";

export default {
  name: "create_site",
  description: "Create a new site to track citations and visibility",
  inputSchema: z.object({
    domain: z.string().describe("The domain (e.g., example.com)"),
  }),

  handler: async ({ domain }: { domain: string }, extra: { authInfo?: { token?: string } }) => {
    try {
      const userId = await verifyBearerToken(extra.authInfo?.token);

      const siteCount = await prisma.site.count({
        where: { ownerId: userId },
      });
      if (siteCount >= 5) throw new Error("Maximum 5 sites allowed");

      const existing = await prisma.site.findFirst({
        where: { domain, ownerId: userId },
      });
      if (existing) throw new Error(`Site ${domain} already exists`);

      const site = await prisma.site.create({
        data: {
          domain,
          content: "",
          summary: "",
          apiKey: crypto.randomUUID(),
          owner: { connect: { id: userId } },
        },
        select: { id: true, domain: true, createdAt: true },
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ ...site, message: `Site ${domain} created` }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  },
};
