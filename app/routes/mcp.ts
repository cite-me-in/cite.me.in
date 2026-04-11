import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import invariant from "tiny-invariant";
import { z } from "zod";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/mcp";

const server = new McpServer({
  name: "cite.me.in",
  version: "1.0.0",
});

async function verifyBearerToken(authHeader: string | null): Promise<string> {
  if (!authHeader?.startsWith("Bearer "))
    throw new Error("Missing or invalid Authorization header");

  const token = authHeader.slice(7);
  const accessToken = await prisma.oAuthAccessToken.findUnique({
    where: { token },
    select: { userId: true, expiresAt: true },
  });

  if (!accessToken || accessToken.expiresAt < new Date())
    throw new Error("Invalid or expired token");

  return accessToken.userId;
}

server.registerTool(
  "list_sites",
  {
    description: "List all your sites",
    inputSchema: z.object({}),
    outputSchema: z.object({
      sites: z.array(z.object({
        id: z.string().describe("The ID of the site"),
        domain: z.string().describe("The domain of the site (e.g. 'example.com')"),
        summary: z.string().describe("The summary of the site (e.g. 'This product is fantastic!' or 'This is a great service!')"),
        createdAt: z.string().describe("The date the site was created (e.g. '2024-01-01')"),
      })).describe("The list of sites"),
    }),
  },
  async (_, extra) => {
    try {
      const userId = await verifyBearerToken(extra.authInfo?.token || null);
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

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(sites, null, 2) },
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
);

server.registerTool(
  "create_site",
  {
    description: "Create a new site to track citations and visibility",
    inputSchema: z.object({
      domain: z.string().describe("The domain (e.g., example.com)"),
    }),
    outputSchema: z.object({
      site: z.object({
        id: z.string().describe("The ID of the site"),
        domain: z.string().describe("The domain of the site (e.g. 'example.com')"),
        summary: z.string().describe("The summary of the site (e.g. 'This product is fantastic!' or 'This is a great service!')"),
        createdAt: z.string().describe("The date the site was created (e.g. '2024-01-01')"),
      }).describe("The created site"),
    }),
  },
  async ({ domain }, extra) => {
    try {
      const userId = await verifyBearerToken(extra.authInfo?.token || null);

      const siteCount = await prisma.site.count({ where: { ownerId: userId } });
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
          owner: { connect: { id: userId } },
        },
        select: { id: true, domain: true, createdAt: true },
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { ...site, message: `Site ${domain} created` },
              null,
              2,
            ),
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
);

server.registerTool(
  "get_site",
  {
    description: "Get detailed information about a site",
    inputSchema: z.object({
      domain: z.string().describe("The domain of the site"),
    }),
    outputSchema: z.object({
      site: z.object({
        id: z.string().describe("The ID of the site"),
        domain: z.string().describe("The domain of the site (e.g. 'example.com')"),
        summary: z.string().describe("The summary of the site (e.g. 'This product is fantastic!' or 'This is a great service!')"),
        createdAt: z.string().describe("The date the site was created (e.g. '2024-01-01')"),
      }).describe("The site"),
      lastProcessedAt: z.string().describe("The date the site was last processed (e.g. '2024-01-01')").nullable(),
      owner: z.string().describe("The email of the owner of the site (e.g. 'user@example.com')"),
      stats: z.object({
        citationRuns: z.number().describe("The number of citation runs"),
        siteQueries: z.number().describe("The number of site queries"),
      }).describe("The stats of the site"),
    }),
  },
  async ({ domain }, extra) => {
    try {
      const userId = await verifyBearerToken(extra.authInfo?.token || null);

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

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                ...site,
                createdAt: site.createdAt.toISOString(),
                lastProcessedAt: site.lastProcessedAt?.toISOString() ?? null,
                owner: site.owner.email,
                stats: site._count,
              },
              null,
              2,
            ),
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
);

server.registerTool(
  "get_site_metrics",
  {
    description: "Get visibility metrics for a site",
    inputSchema: z.object({
      domain: z.string().describe("The domain of the site"),
    }),
    outputSchema: z.object({
      domain: z.string().describe("The domain of the site"),
      weekStart: z.string().describe("The start date of the week (e.g. '2024-01-01')"),
      allCitations: z.object({
        current: z.number().describe("The number of citations for the current week"),
        previous: z.number().describe("The number of citations for the previous week"),
      }).describe("The all citations"),
      yourCitations: z.object({
        current: z.number().describe("The number of citations for the current week"),
        previous: z.number().describe("The number of citations for the previous week"),
      }).describe("The your citations"),
      visibilityRate: z.string().describe("The visibility rate (e.g. '80.0%')"),
      weekOverWeekChange: z.string().describe("The week over week change (e.g. '10.0%')"),
    }),
  },
  async ({ domain }, extra) => {
    try {
      const userId = await verifyBearerToken(extra.authInfo?.token || null);

      const site = await prisma.site.findFirst({
        where: {
          domain,
          OR: [{ ownerId: userId }, { siteUsers: { some: { userId } } }],
        },
        select: { id: true },
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
          select: { citations: true },
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
          select: { citations: true },
        }),
      ]);

      const domainLower = domain.toLowerCase().replace(/^www\./, "");

      const countYourCitations = (queries: typeof currentWeek) =>
        queries.reduce(
          (sum, q) =>
            sum +
            q.citations.filter((c) =>
              c
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

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                domain,
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
              null,
              2,
            ),
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
);

server.registerTool(
  "get_site_queries",
  {
    description: "Get recent citation queries for a site",
    inputSchema: z.object({
      domain: z.string().describe("The domain of the site"),
      limit: z.number().optional().default(10).describe("Max queries per run"),
    }),
    outputSchema: z.object({
      domain: z.string().describe("The domain of the site"),
      runs: z.array(z.object({
        platform: z.string().describe("The platform of the run (e.g. 'OpenAI' or 'Google')"),
        model: z.string().describe("The model of the run (e.g. 'gpt-4' or 'gemini-1.5-flash')"),
        date: z.string().describe("The date of the run (e.g. '2024-01-01')"),
      })),
      queries: z.array(z.object({
        group: z.string().describe("The group of the query (e.g. 'Product Features' or 'Customer Support')"),
        query: z.string().describe("The query (e.g. 'What is the best way to use the product?')"),
        response: z.string().describe("The response from the query (e.g. 'The best way to use the product is to read the documentation.')"),
        citationCount: z.number().describe("The number of citations for the query"),
        mentionsYourSite: z.boolean().describe("Whether the query mentions the site (e.g. true or false)"),
      })).describe("The queries"),
    }),
  },
  async ({ domain, limit = 10 }, extra) => {
    try {
      const userId = await verifyBearerToken(extra.authInfo?.token || null);

      const site = await prisma.site.findFirst({
        where: {
          domain,
          OR: [{ ownerId: userId }, { siteUsers: { some: { userId } } }],
        },
        select: { id: true },
      });

      if (!site) throw new Error(`Site ${domain} not found`);

      const runs = await prisma.citationQueryRun.findMany({
        where: { siteId: site.id },
        select: {
          platform: true,
          model: true,
          onDate: true,
          queries: {
            select: { query: true, group: true, citations: true, text: true },
            orderBy: { query: "asc" },
            take: limit,
          },
        },
        orderBy: { onDate: "desc" },
        take: 3,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                domain,
                runs: runs.map((run) => ({
                  platform: run.platform,
                  model: run.model,
                  date: run.onDate,
                  queries: run.queries.map((q) => ({
                    group: q.group,
                    query: q.query,
                    response: q.text,
                    citationCount: q.citations.length,
                    mentionsYourSite: q.citations.some((c) =>
                      c.toLowerCase().includes(domain.toLowerCase()),
                    ),
                  })),
                })),
              },
              null,
              2,
            ),
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
);

const transports = new Map<string, WebStandardStreamableHTTPServerTransport>();

export async function action({ request }: Route.ActionArgs) {
  const sessionId = request.headers.get("mcp-session-id");
  if (sessionId && transports.has(sessionId)) {
    const transport = transports.get(sessionId);
    invariant(transport, "Transport not found");
    return transport.handleRequest(request);
  } else {
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      onsessioninitialized: (id) => {
        transports.set(id, transport);
      },
    });

    transport.onclose = () => {
      if (transport.sessionId) transports.delete(transport.sessionId);
    };

    await server.connect(transport);
    return transport.handleRequest(request);
  }
}
