import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "~/lib/mcp/server";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/mcp";

const transports = new Map<
  string,
  {
    transport: WebStandardStreamableHTTPServerTransport;
    server: ReturnType<typeof createMcpServer>;
  }
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
