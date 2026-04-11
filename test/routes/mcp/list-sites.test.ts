import { beforeAll, describe, expect, it } from "vitest";
import {
  SITE_DOMAIN,
  accessToken,
  initSession,
  mcpRequest,
  parseSSEResponse,
} from "./setup";

describe("list_sites", () => {
  let sessionId: string;

  beforeAll(async () => {
    sessionId = await initSession();
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
