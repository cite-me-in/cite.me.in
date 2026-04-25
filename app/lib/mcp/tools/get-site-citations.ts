import { z } from "zod";
import { verifyBearerToken } from "~/lib/mcp/auth";
import prisma from "~/lib/prisma.server";

export default {
  name: "get_site_citations",
  description:
    "Get recent citations for a site - shows which queries mention your site across all platforms",
  inputSchema: z.object({
    domain: z.string().describe("The domain of the site"),
  }),
  outputSchema: z.object({
    domain: z.string(),
    date: z.string().nullable(),
    queries: z.array(
      z.object({
        query: z.string(),
        group: z.string(),
        platforms: z.array(
          z.object({
            platform: z.string(),
            model: z.string(),
            response: z.string(),
            citations: z.array(
              z.object({
                url: z.string(),
                relationship: z.string().optional(),
                reason: z.string().optional(),
              }),
            ),
            mentionsYourSite: z.number(),
            directCitations: z.number(),
            indirectCitations: z.number(),
          }),
        ),
      }),
    ),
  }),
  handler: async (
    { domain }: { domain: string },
    extra: { authInfo?: { token?: string } },
  ) => {
    try {
      const userId = await verifyBearerToken(extra.authInfo?.token);

      const site = await prisma.site.findFirst({
        where: {
          domain,
          OR: [{ ownerId: userId }, { siteUsers: { some: { userId } } }],
        },
        select: { id: true },
      });

      if (!site) throw new Error(`Site ${domain} not found`);

      const latestRun = await prisma.citationQueryRun.findFirst({
        where: { siteId: site.id },
        orderBy: { onDate: "desc" },
        select: { onDate: true },
      });

      if (!latestRun) {
        const result = { domain, date: null, queries: [] };
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
          structuredContent: result,
        };
      }

      const runs = await prisma.citationQueryRun.findMany({
        where: { siteId: site.id, onDate: latestRun.onDate },
        select: {
          id: true,
          platform: true,
          model: true,
          onDate: true,
          queries: {
            select: {
              query: true,
              group: true,
              text: true,
              citations: {
                select: { url: true, relationship: true, reason: true },
              },
            },
          },
        },
      });

      const queryMap = new Map<
        string,
        {
          query: string;
          group: string;
          platforms: {
            platform: string;
            model: string;
            response: string;
            citations: {
              url: string;
              relationship?: string;
              reason?: string | null;
            }[];
            mentionsYourSite: number;
            directCitations: number;
            indirectCitations: number;
          }[];
        }
      >();

      for (const run of runs) {
        for (const q of run.queries) {
          const existing = queryMap.get(q.query);
          const citations = q.citations.map((c) => ({
            url: c.url,
            ...(c.relationship && {
              relationship: c.relationship,
            }),
            ...(c.reason && { reason: c.reason }),
          }));

          const directCitations = citations.filter(
            (c) => c.relationship === "direct",
          ).length;
          const indirectCitations = citations.filter(
            (c) => c.relationship === "indirect",
          ).length;
          const mentionsYourSite = directCitations + indirectCitations;

          const platformResult = {
            platform: run.platform,
            model: run.model,
            response: q.text,
            citations,
            mentionsYourSite,
            directCitations,
            indirectCitations,
          };

          if (existing) {
            existing.platforms.push(platformResult);
          } else {
            queryMap.set(q.query, {
              query: q.query,
              group: q.group,
              platforms: [platformResult],
            });
          }
        }
      }

      const queries = Array.from(queryMap.values()).sort((a, b) =>
        a.query.localeCompare(b.query),
      );

      const result = {
        domain,
        date: latestRun.onDate,
        queries,
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
        structuredContent: result,
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
