import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/mcp";

async function verifyBearerToken(token: string | undefined): Promise<string> {
  if (!token) throw new Error("Missing token");
  const accessToken = await prisma.oAuthAccessToken.findUnique({
    where: { token },
    select: { userId: true, expiresAt: true },
  });
  if (!accessToken || accessToken.expiresAt < new Date())
    throw new Error("Invalid or expired token");
  return accessToken.userId;
}

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "cite.me.in",
    version: "1.0.0",
  });

  server.registerTool(
    "list_sites",
    {
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
    },
    async (_, extra) => {
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
    },
    async ({ domain }, extra) => {
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
    },
    async ({ domain }, extra) => {
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
    },
    async ({ domain }, extra) => {
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
          previous: previousWeek.reduce(
            (sum, q) => sum + q.citations.length,
            0,
          ),
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
        limit: z
          .number()
          .optional()
          .default(10)
          .describe("Max queries per run"),
      }),
    },
    async ({ domain, limit = 10 }, extra) => {
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

  return server;
}

const transports = new Map<
  string,
  { transport: WebStandardStreamableHTTPServerTransport; server: McpServer }
>();

export async function action({ request }: Route.ActionArgs) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) throw new Response("Unauthorized", { status: 401 });

  const match = authHeader.match(/^Bearer\s+(\S+)/);
  if (!match) throw new Response("Unauthorized", { status: 401 });
  const token = match[1];

  const tokenRecord = await prisma.oAuthAccessToken.findUnique({
    where: { token },
    select: { clientId: true, scopes: true },
  });
  if (!tokenRecord) throw new Response("Forbidden", { status: 403 });

  const authInfo = {
    token,
    clientId: tokenRecord.clientId,
    scopes: tokenRecord.scopes,
  };
  const sessionId = request.headers.get("mcp-session-id");
  if (sessionId && transports.has(sessionId)) {
    const session = transports.get(sessionId);
    if (!session) throw new Response("Forbidden", { status: 403 });
    return session.transport.handleRequest(request, { authInfo });
  }

  const server = createMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
    onsessioninitialized: (id) => {
      transports.set(id, { transport, server });
    },
  });

  transport.onclose = () => {
    if (transport.sessionId) transports.delete(transport.sessionId);
  };

  await server.connect(transport);
  return transport.handleRequest(request, { authInfo });
}
