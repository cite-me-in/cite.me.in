import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import prisma from "~/lib/prisma.server";
import { accessToken, initSession, mcpRequest, parseResponse } from "./setup";

describe("create_site", () => {
  beforeAll(async () => {
    await initSession();
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

    const NEW_DOMAIN = "create-site-test.example";

    beforeAll(async () => {
      response = await mcpRequest({
        accessToken,
        body: {
          jsonrpc: "2.0",
          id: 10,
          method: "tools/call",
          params: { name: "create_site", arguments: { domain: NEW_DOMAIN } },
        },
      });
      const rawText = await response.text();
      body = parseResponse(rawText) as typeof body;
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
            arguments: { domain: "mcp-test-site-1.example" },
          },
        },
      });
      body = parseResponse(await response.text()) as typeof body;
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
