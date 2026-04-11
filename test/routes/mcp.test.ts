import invariant from "tiny-invariant";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import prisma from "~/lib/prisma.server";
import { port } from "~/test/helpers/launchBrowser";

const BASE = `http://localhost:${port}`;
const USER_ID = "mcp-test-user-1";
const EMAIL = "mcp-test@example.com";
const SITE_DOMAIN = "mcp-test.example";

const OAUTH_CLIENT_ID = "mcp-test-client";
const OAUTH_CLIENT_SECRET = "mcp-test-secret";

const accessToken = `test-access-token-${Date.now()}`;

function parseSSEResponse(body: string): Record<string, unknown> {
  const lines = body.split("\n");
  for (const line of lines) {
    if (line.startsWith("data: ")) return JSON.parse(line.slice(6));
  }
  throw new Error("No data line found in SSE response");
}

async function mcpRequest({
  accessToken,
  body,
  sessionId,
}: {
  accessToken: string;
  body: object;
  sessionId?: string;
}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    Authorization: `Bearer ${accessToken}`,
  };
  if (sessionId) headers["MCP-Session-ID"] = sessionId;

  return fetch(`${BASE}/mcp`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  await prisma.user.upsert({
    where: { id: USER_ID },
    create: {
      id: USER_ID,
      email: EMAIL,
      passwordHash: "test",
      ownedSites: {
        create: {
          content: "Test content",
          domain: SITE_DOMAIN,
          summary: "Test summary",
        },
      },
    },
    update: {},
  });

  await prisma.oAuthClient.upsert({
    where: { clientId: OAUTH_CLIENT_ID },
    create: {
      name: "MCP Test Client",
      clientId: OAUTH_CLIENT_ID,
      clientSecret: OAUTH_CLIENT_SECRET,
      redirectUris: [],
      scopes: ["sites:read"],
      accessTokens: {
        create: {
          token: accessToken,
          userId: USER_ID,
          scopes: ["sites:read"],
          expiresAt: new Date(Date.now() + 3600000),
        },
      },
    },
    update: {},
  });
});

describe("POST /mcp", () => {
  describe("initialization", () => {
    let response: Response;

    beforeAll(async () => {
      response = await mcpRequest({
        accessToken,
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
      });
    });

    it("should return 200", async () => {
      expect(response.status).toBe(200);
    });

    it("should return a session ID", async () => {
      expect(response.headers.get("mcp-session-id")).toBeTruthy();
    });

    it("should return the protocol version and server info", async () => {
      const body = parseSSEResponse(await response.text()) as {
        result: { protocolVersion: string; serverInfo: { name: string } };
      };
      expect(body.result.protocolVersion).toBe("2024-11-05");
      expect(body.result.serverInfo.name).toBe("cite.me.in");
    });
  });

  describe("list_sites", () => {
    let sessionId: string;

    beforeAll(async () => {
      const initRes = await mcpRequest({
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
      sessionId = initRes.headers.get("MCP-Session-ID") ?? "";
      invariant(sessionId, "Session ID is required");
    });

    describe("without authorization", () => {
      let response: Response;
      beforeAll(async () => {
        response = await mcpRequest({
          body: {
            jsonrpc: "2.0",
            id: 3,
            method: "tools/call",
            params: { name: "list_sites", arguments: {} },
          },
          accessToken: "",
        });
      });

      it("should return 401", async () => {
        expect(response.status).toBe(401);
      });
    });

    describe("without valid token", () => {
      let response: Response;
      beforeAll(async () => {
        response = await mcpRequest({
          accessToken: "invalid-token",
          body: {
            jsonrpc: "2.0",
            id: 3,
            method: "tools/call",
            params: { name: "list_sites", arguments: {} },
          },
        });
      });

      it("should return 403", async () => {
        expect(response.status).toBe(403);
      });
    });

    describe("with valid token", () => {
      let response: Response;
      let body: {
        jsonrpc: string;
        result: {
          isError: boolean;
          content: {
            type: "text";
            text: string;
          }[];
        };
      };

      beforeAll(async () => {
        response = await mcpRequest({
          accessToken,
          body: {
            jsonrpc: "2.0",
            id: 3,
            method: "tools/call",
            params: { name: "list_sites", arguments: {} },
          },
          sessionId,
        });
        body = parseSSEResponse(await response.text()) as typeof body;
      });

      it("should return 200", async () => {
        expect(response.status).toBe(200);
      });

      it("should return the JSON-RPC version", async () => {
        expect(body.jsonrpc).toBe("2.0");
      });

      it("should return without errors", async () => {
        expect(body.result.isError).not.toBeTruthy();
      });

      it("should return text content", async () => {
        expect(body.result.content).toBeDefined();
        expect(body.result.content.length).toBeGreaterThan(0);
        expect(body.result.content[0]).toBeDefined();
        expect(body.result.content[0].type).toBe("text");
      });

      it("should return structured content with sites", async () => {
        const content = JSON.parse(body.result.content[0].text) as {
          sites: {
            id: string;
            domain: string;
            summary: string;
            createdAt: string;
          }[];
        };
        expect(content.sites).toBeDefined();
        expect(content.sites.length).toBeGreaterThan(0);
        expect(content.sites[0]).toBeDefined();
      });

      it("should return the first site", async () => {
        const content = JSON.parse(body.result.content[0].text) as {
          sites: {
            id: string;
            domain: string;
            summary: string;
            createdAt: string;
          }[];
        };
        const site = content.sites[0];
        expect(site.id).toBeDefined();
        expect(site.domain).toBe(SITE_DOMAIN);
        expect(site.summary).toBe("Test summary");
        expect(site.createdAt).toMatch(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
        );
      });
    });
  });

  describe("create_site", () => {
    let sessionId: string;

    beforeAll(async () => {
      const initRes = await mcpRequest({
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
      sessionId = initRes.headers.get("MCP-Session-ID") ?? "";
      invariant(sessionId, "Session ID is required");
    });

    describe("with valid domain", () => {
      let response: Response;
      let body: {
        jsonrpc: string;
        result: {
          isError: boolean;
          content: { type: "text"; text: string }[];
        };
      };

      const NEW_DOMAIN = "new-site.example";

      beforeAll(async () => {
        response = await mcpRequest({
          accessToken,
          body: {
            jsonrpc: "2.0",
            id: 10,
            method: "tools/call",
            params: { name: "create_site", arguments: { domain: NEW_DOMAIN } },
          },
          sessionId,
        });
        body = parseSSEResponse(await response.text()) as typeof body;
      });

      afterAll(async () => {
        await prisma.site.deleteMany({ where: { domain: NEW_DOMAIN } });
      });

      it("should return 200", async () => {
        expect(response.status).toBe(200);
      });

      it("should return without errors", async () => {
        expect(body.result.isError).not.toBeTruthy();
      });

      it("should return the created site", async () => {
        const content = JSON.parse(body.result.content[0].text) as {
          id: string;
          domain: string;
          createdAt: string;
          message: string;
        };
        expect(content.id).toBeDefined();
        expect(content.domain).toBe(NEW_DOMAIN);
        expect(content.createdAt).toMatch(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
        );
        expect(content.message).toContain("created");
      });
    });

    describe("with duplicate domain", () => {
      let response: Response;
      let body: {
        jsonrpc: string;
        result: {
          isError: boolean;
          content: { type: "text"; text: string }[];
        };
      };

      beforeAll(async () => {
        response = await mcpRequest({
          accessToken,
          body: {
            jsonrpc: "2.0",
            id: 11,
            method: "tools/call",
            params: {
              name: "create_site",
              arguments: { domain: SITE_DOMAIN },
            },
          },
          sessionId,
        });
        body = parseSSEResponse(await response.text()) as typeof body;
      });

      it("should return 200", async () => {
        expect(response.status).toBe(200);
      });

      it("should return an error", async () => {
        expect(body.result.isError).toBe(true);
        expect(body.result.content[0].text).toContain("already exists");
      });
    });

    describe("without authorization", () => {
      let response: Response;

      beforeAll(async () => {
        response = await mcpRequest({
          accessToken: "",
          body: {
            jsonrpc: "2.0",
            id: 12,
            method: "tools/call",
            params: {
              name: "create_site",
              arguments: { domain: "unauthorized.example" },
            },
          },
        });
      });

      it("should return 401", async () => {
        expect(response.status).toBe(401);
      });
    });
  });

  describe("get_site", () => {
    let sessionId: string;

    beforeAll(async () => {
      const initRes = await mcpRequest({
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
      sessionId = initRes.headers.get("MCP-Session-ID") ?? "";
      invariant(sessionId, "Session ID is required");
    });

    describe("with valid domain", () => {
      let response: Response;
      let body: {
        jsonrpc: string;
        result: {
          isError: boolean;
          content: { type: "text"; text: string }[];
        };
      };

      beforeAll(async () => {
        response = await mcpRequest({
          accessToken,
          body: {
            jsonrpc: "2.0",
            id: 20,
            method: "tools/call",
            params: { name: "get_site", arguments: { domain: SITE_DOMAIN } },
          },
          sessionId,
        });
        body = parseSSEResponse(await response.text()) as typeof body;
      });

      it("should return 200", async () => {
        expect(response.status).toBe(200);
      });

      it("should return without errors", async () => {
        expect(body.result.isError).not.toBeTruthy();
      });

      it("should return site details", async () => {
        const content = JSON.parse(body.result.content[0].text) as {
          id: string;
          domain: string;
          summary: string;
          createdAt: string;
          lastProcessedAt: string | null;
          owner: string;
          queryCount: number;
          runCount: number;
        };
        expect(content.id).toBeDefined();
        expect(content.domain).toBe(SITE_DOMAIN);
        expect(content.summary).toBe("Test summary");
        expect(content.createdAt).toMatch(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
        );
        expect(content.owner).toBe(EMAIL);
        expect(typeof content.queryCount).toBe("number");
        expect(typeof content.runCount).toBe("number");
      });

      it("should return visibility metrics", async () => {
        const content = JSON.parse(body.result.content[0].text) as {
          metrics: {
            weekStart: string;
            allCitations: { current: number; previous: number };
            yourCitations: { current: number; previous: number };
            visibilityRate: string;
            weekOverWeekChange: string;
          };
        };
        expect(content.metrics.weekStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(typeof content.metrics.allCitations.current).toBe("number");
        expect(typeof content.metrics.allCitations.previous).toBe("number");
        expect(typeof content.metrics.yourCitations.current).toBe("number");
        expect(typeof content.metrics.yourCitations.previous).toBe("number");
        expect(typeof content.metrics.visibilityRate).toBe("string");
        expect(typeof content.metrics.weekOverWeekChange).toBe("string");
      });
    });

    describe("with non-existent domain", () => {
      let response: Response;
      let body: {
        jsonrpc: string;
        result: {
          isError: boolean;
          content: { type: "text"; text: string }[];
        };
      };

      beforeAll(async () => {
        response = await mcpRequest({
          accessToken,
          body: {
            jsonrpc: "2.0",
            id: 21,
            method: "tools/call",
            params: {
              name: "get_site",
              arguments: { domain: "nonexistent.example" },
            },
          },
          sessionId,
        });
        body = parseSSEResponse(await response.text()) as typeof body;
      });

      it("should return 200", async () => {
        expect(response.status).toBe(200);
      });

      it("should return an error", async () => {
        expect(body.result.isError).toBe(true);
        expect(body.result.content[0].text).toContain("not found");
      });
    });

    describe("without authorization", () => {
      let response: Response;

      beforeAll(async () => {
        response = await mcpRequest({
          accessToken: "",
          body: {
            jsonrpc: "2.0",
            id: 22,
            method: "tools/call",
            params: {
              name: "get_site",
              arguments: { domain: SITE_DOMAIN },
            },
          },
        });
      });

      it("should return 401", async () => {
        expect(response.status).toBe(401);
      });
    });
  });
});
