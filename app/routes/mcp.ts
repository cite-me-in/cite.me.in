import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import envVars from "~/lib/envVars.server";
import { createMcpServer } from "~/lib/mcp/server";
import { verifyAccessToken } from "~/lib/oauth/server";
import prisma from "~/lib/prisma.server";
import { checkRateLimit } from "~/lib/rateLimit.server";
import type { Route } from "./+types/mcp";

const authResource = {
  "WWW-Authenticate": `Bearer realm="mcp", resource_metadata="${new URL(
    ".well-known/oauth-protected-resource",
    envVars.VITE_APP_URL,
  ).toString()}"`,
};

export async function loader() {
  throw new Response("Method Not Allowed", { status: 405 });
}

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

  const rateLimit = await checkRateLimit(userId);
  if (!rateLimit.allowed)
    throw new Response("Too Many Requests", {
      status: 429,
      headers: {
        "Retry-After": String(
          Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
        ),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(rateLimit.resetAt),
      },
    });

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

  const server = createMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);
  return transport.handleRequest(request, { authInfo });
}
