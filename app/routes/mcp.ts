import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import envVars from "~/lib/envVars.server";
import { createMcpServer } from "~/lib/mcp/server";
import { verifyAccessToken } from "~/lib/oauth/server";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/mcp";

interface TransportSession {
  transport: WebStandardStreamableHTTPServerTransport;
  server: ReturnType<typeof createMcpServer>;
  userId: string;
}

const transports = new Map<string, TransportSession>();

const authResource = {
  "WWW-Authenticate": `Bearer realm="mcp", resource_metadata="${new URL(
    ".well-known/oauth-protected-resource",
    envVars.VITE_APP_URL,
  ).toString()}"`,
};

export async function action({ request }: Route.ActionArgs) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader)
    throw new Response("Unauthorized", { headers: authResource, status: 401 });

  const match = authHeader.match(/^Bearer\s+(\S+)/);
  if (!match)
    throw new Response("Unauthorized", { headers: authResource, status: 401 });
  const token = match[1];

  const tokenData = await verifyAccessToken(token);
  if (!tokenData)
    throw new Response("Forbidden", { headers: authResource, status: 403 });

  const { userId, scopes } = tokenData;

  const tokenRecord = await prisma.oAuthAccessToken.findUnique({
    where: { token },
    select: { clientId: true },
  });
  if (!tokenRecord)
    throw new Response("Forbidden", { headers: authResource, status: 403 });

  const authInfo = {
    token,
    clientId: tokenRecord.clientId,
    scopes,
  };

  const sessionId = request.headers.get("mcp-session-id");
  if (sessionId) {
    const session = transports.get(sessionId);
    if (!session || session.userId !== userId)
      throw new Response("Forbidden", { headers: authResource, status: 403 });
    return session.transport.handleRequest(request, { authInfo });
  }

  const server = createMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
    onsessioninitialized: (id) => {
      transports.set(id, { transport, server, userId });
    },
  });

  transport.onclose = () => {
    if (transport.sessionId) transports.delete(transport.sessionId);
  };

  await server.connect(transport);
  return transport.handleRequest(request, { authInfo });
}
