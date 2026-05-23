import { z } from "zod";
import { verifyBearerToken } from "~/lib/mcp/auth";
import prisma from "~/lib/prisma.server";

export default {
  name: "get_site",

  description:
    "Get detailed information about a site including visibility metrics",
  inputSchema: z.object({
    domain: z.string().describe("The domain of the site"),
  }),
  outputSchema: z.object({
    id: z.string(),
    domain: z.string(),
    summary: z.string(),
    createdAt: z.string(),
    lastProcessedAt: z.string().nullable(),
    owner: z.string(),
    queryCount: z.number(),
    runCount: z.number(),
    metrics: z.object({
      weekStart: z.string(),
      allCitations: z.object({
        current: z.number(),
        previous: z.number(),
      }),
      yourCitations: z.object({
        current: z.number(),
        previous: z.number(),
      }),
      visibilityRate: z.string(),
      weekOverWeekChange: z.string(),
    }),
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
        select: {
          id: true,
          domain: true,
          summary: true,
          createdAt: true,
          lastProcessedAt: true,
          owner: { select: { email: true } },
          _count: { select: { citationRuns: true, siteQueries: true } },
        },
      });

      if (!site) throw new Error(`Site ${domain} not found`);

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

      const [currentWeek, previousWeek] = await Promise.all([
        prisma.citationQuery.findMany({
          where: {
            run: {
              siteId: site.id,
              onDate: { gte: weekAgo.toISOString().split("T")[0] },
            },
          },
          select: { citations: { select: { url: true } } },
        }),
        prisma.citationQuery.findMany({
          where: {
            run: {
              siteId: site.id,
              onDate: {
                gte: twoWeeksAgo.toISOString().split("T")[0],
                lt: weekAgo.toISOString().split("T")[0],
              },
            },
          },
          select: { citations: { select: { url: true } } },
        }),
      ]);

      const domainLower = domain.toLowerCase().replace(/^www\./, "");

      const countYourCitations = (queries: typeof currentWeek) =>
        queries.reduce(
          (sum, q) =>
            sum +
            q.citations.filter((c) =>
              c.url
                .toLowerCase()
                .replace(/^www\./, "")
                .includes(domainLower),
            ).length,
          0,
        );

      const allCitations = {
        current: currentWeek.reduce((sum, q) => sum + q.citations.length, 0),
        previous: previousWeek.reduce((sum, q) => sum + q.citations.length, 0),
      };

      const yourCitations = {
        current: countYourCitations(currentWeek),
        previous: countYourCitations(previousWeek),
      };

      const result = {
        id: site.id,
        domain: site.domain,
        summary: site.summary,
        createdAt: site.createdAt.toISOString(),
        lastProcessedAt: site.lastProcessedAt?.toISOString() ?? null,
        owner: site.owner.email,
        queryCount: site._count.siteQueries,
        runCount: site._count.citationRuns,
        metrics: {
          weekStart: weekAgo.toISOString().split("T")[0],
          allCitations,
          yourCitations,
          visibilityRate:
            allCitations.current > 0
              ? `${((yourCitations.current / allCitations.current) * 100).toFixed(1)}%`
              : "N/A",
          weekOverWeekChange:
            yourCitations.previous > 0
              ? `${(((yourCitations.current - yourCitations.previous) / yourCitations.previous) * 100).toFixed(1)}%`
              : "N/A",
        },
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
