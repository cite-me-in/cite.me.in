import { beforeAll } from "vitest";
import prisma from "~/lib/prisma.server";
import { resetRateLimit } from "~/lib/rateLimit.server";
import { port } from "~/test/helpers/launchServer";

export const accessToken = `test-access-token-${Date.now()}`;

export function parseResponse(body: string): Record<string, unknown> {
  return JSON.parse(body);
}

export async function mcpRequest({ accessToken, body }: { accessToken: string; body: object }) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    Authorization: `Bearer ${accessToken}`,
  };

  return fetch(`http://localhost:${port}/mcp`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

export async function initSession(): Promise<void> {
  await mcpRequest({
    body: {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test", version: "1.0.0" },
      },
    },
    accessToken,
  });
}

beforeAll(async () => {
  await resetRateLimit("mcp-test-user-1");

  await prisma.user.upsert({
    where: { id: "mcp-test-user-1" },
    create: {
      id: "mcp-test-user-1",
      email: "mcp-test-user-1@example.com",
      passwordHash: "test",
      ownedSites: {
        create: {
          content: "Test content",
          domain: "mcp-test-site-1.example",
          summary: "Test summary",
        },
      },
    },
    update: {},
  });

  await prisma.oAuthClient.upsert({
    where: { clientId: "mcp-test-client" },
    create: {
      name: "MCP Test Client",
      clientId: "mcp-test-client",
      clientSecret: "mcp-test-secret",
      redirectUris: [],
      scopes: ["sites:read"],
      accessTokens: {
        create: {
          token: accessToken,
          userId: "mcp-test-user-1",
          scopes: ["sites:read"],
          expiresAt: new Date(Date.now() + 3600000),
        },
      },
    },
    update: {},
  });
});
