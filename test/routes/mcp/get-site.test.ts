import { beforeAll, describe, expect, it } from "vitest";
import {
  EMAIL,
  SITE_DOMAIN,
  accessToken,
  initSession,
  mcpRequest,
  parseSSEResponse,
} from "./setup";

describe("get_site", () => {
  let sessionId: string;

  beforeAll(async () => {
    sessionId = await initSession();
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
