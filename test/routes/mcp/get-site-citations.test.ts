import invariant from "tiny-invariant";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import prisma from "~/lib/prisma.server";
import {
  accessToken,
  initSession,
  mcpRequest,
  parseSSEResponse,
} from "./setup";

const CITATIONS_DOMAIN = "citations-test.example";

describe("get_site_citations", () => {
  let sessionId: string;

  beforeAll(async () => {
    const site = await prisma.site.create({
      data: {
        domain: CITATIONS_DOMAIN,
        content: "",
        summary: "",
        apiKey: crypto.randomUUID(),
        ownerId: "mcp-test-user-1",
      },
    });

    const today = new Date().toISOString().split("T")[0];

    await prisma.citationQueryRun.createMany({
      data: [
        {
          siteId: site.id,
          platform: "openai",
          model: "gpt-4",
          onDate: today,
        },
        {
          siteId: site.id,
          platform: "anthropic",
          model: "claude-3",
          onDate: today,
        },
      ],
    });

    const runs = await prisma.citationQueryRun.findMany({
      where: { siteId: site.id },
    });

    const openaiRun = runs.find((r) => r.platform === "openai");
    const anthropicRun = runs.find((r) => r.platform === "anthropic");
    invariant(openaiRun, "OpenAI run not found");
    invariant(anthropicRun, "Anthropic run not found");

    const openaiQueries = await prisma.citationQuery.createManyAndReturn({
      data: [
        {
          runId: openaiRun.id,
          query: "What is the best framework?",
          group: "frameworks",
          text: "The best frameworks are React, Vue, and Angular.",
        },
        {
          runId: openaiRun.id,
          query: "What is Node.js?",
          group: "runtimes",
          text: "Node.js is a JavaScript runtime.",
        },
      ],
    });

    const anthropicQueries = await prisma.citationQuery.createManyAndReturn({
      data: [
        {
          runId: anthropicRun.id,
          query: "What is the best framework?",
          group: "frameworks",
          text: "React and Vue are popular choices.",
        },
        {
          runId: anthropicRun.id,
          query: "What is Node.js?",
          group: "runtimes",
          text: "Node.js runs JavaScript server-side.",
        },
      ],
    });

    const openaiFrameworkQuery = openaiQueries.find(
      (q) => q.query === "What is the best framework?",
    );
    const openaiNodeQuery = openaiQueries.find(
      (q) => q.query === "What is Node.js?",
    );
    const anthropicFrameworkQuery = anthropicQueries.find(
      (q) => q.query === "What is the best framework?",
    );
    const anthropicNodeQuery = anthropicQueries.find(
      (q) => q.query === "What is Node.js?",
    );

    invariant(openaiFrameworkQuery, "OpenAI framework query not found");
    invariant(openaiNodeQuery, "OpenAI node query not found");
    invariant(anthropicFrameworkQuery, "Anthropic framework query not found");
    invariant(anthropicNodeQuery, "Anthropic node query not found");

    await prisma.citation.createMany({
      data: [
        {
          siteId: site.id,
          runId: openaiRun.id,
          queryId: openaiFrameworkQuery.id,
          url: "https://react.dev",
          domain: "react.dev",
        },
        {
          siteId: site.id,
          runId: openaiRun.id,
          queryId: openaiFrameworkQuery.id,
          url: "https://vuejs.org",
          domain: "vuejs.org",
        },
        {
          siteId: site.id,
          runId: openaiRun.id,
          queryId: openaiFrameworkQuery.id,
          url: `https://${CITATIONS_DOMAIN}`,
          domain: CITATIONS_DOMAIN,
          relationship: "direct",
          reason: "Direct mention of site",
        },
        {
          siteId: site.id,
          runId: openaiRun.id,
          queryId: openaiFrameworkQuery.id,
          url: "https://angular.io",
          domain: "angular.io",
        },
        {
          siteId: site.id,
          runId: openaiRun.id,
          queryId: openaiNodeQuery.id,
          url: "https://nodejs.org",
          domain: "nodejs.org",
        },
        {
          siteId: site.id,
          runId: openaiRun.id,
          queryId: openaiNodeQuery.id,
          url: `https://${CITATIONS_DOMAIN}`,
          domain: CITATIONS_DOMAIN,
          relationship: "direct",
          reason: "Direct mention of site",
        },
        {
          siteId: site.id,
          runId: anthropicRun.id,
          queryId: anthropicFrameworkQuery.id,
          url: "https://react.dev",
          domain: "react.dev",
        },
        {
          siteId: site.id,
          runId: anthropicRun.id,
          queryId: anthropicFrameworkQuery.id,
          url: `https://${CITATIONS_DOMAIN}`,
          domain: CITATIONS_DOMAIN,
          relationship: "direct",
          reason: "Direct mention of site",
        },
        {
          siteId: site.id,
          runId: anthropicRun.id,
          queryId: anthropicNodeQuery.id,
          url: "https://nodejs.org",
          domain: "nodejs.org",
        },
        {
          siteId: site.id,
          runId: anthropicRun.id,
          queryId: anthropicNodeQuery.id,
          url: `https://${CITATIONS_DOMAIN}`,
          domain: CITATIONS_DOMAIN,
          relationship: "direct",
          reason: "Direct mention of site",
        },
      ],
    });

    sessionId = await initSession();
  });

  afterAll(async () => {
    const site = await prisma.site.findFirst({
      where: { domain: CITATIONS_DOMAIN },
    });
    if (site) {
      await prisma.citation.deleteMany({
        where: { siteId: site.id },
      });
      await prisma.citationQuery.deleteMany({
        where: { run: { siteId: site.id } },
      });
      await prisma.citationQueryRun.deleteMany({
        where: { siteId: site.id },
      });
      await prisma.site.delete({ where: { id: site.id } });
    }
  });

  describe("with valid domain and citation data", () => {
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
          id: 30,
          method: "tools/call",
          params: {
            name: "get_site_citations",
            arguments: { domain: CITATIONS_DOMAIN },
          },
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

    it("should return domain and date", async () => {
      const content = JSON.parse(body.result.content[0].text) as {
        domain: string;
        date: string;
      };
      expect(content.domain).toBe(CITATIONS_DOMAIN);
      expect(content.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("should return queries grouped by query text", async () => {
      const content = JSON.parse(body.result.content[0].text) as {
        queries: { query: string; group: string; platforms: unknown[] }[];
      };
      expect(content.queries.length).toBe(2);
      const queryTexts = content.queries.map((q) => q.query);
      expect(queryTexts).toContain("What is Node.js?");
      expect(queryTexts).toContain("What is the best framework?");
    });

    it("should return platforms for each query", async () => {
      const content = JSON.parse(body.result.content[0].text) as {
        queries: {
          query: string;
          platforms: { platform: string; model: string }[];
        }[];
      };
      for (const q of content.queries) {
        expect(q.platforms.length).toBe(2);
        const platforms = q.platforms.map((p) => p.platform);
        expect(platforms).toContain("openai");
        expect(platforms).toContain("anthropic");
      }
    });

    it("should count mentions correctly", async () => {
      const content = JSON.parse(body.result.content[0].text) as {
        queries: {
          query: string;
          platforms: {
            platform: string;
            mentionsYourSite: number;
            directCitations: number;
            indirectCitations: number;
          }[];
        }[];
      };

      const frameworkQuery = content.queries.find(
        (q) => q.query === "What is the best framework?",
      );
      invariant(frameworkQuery, "Framework query not found");
      const openaiPlatform = frameworkQuery.platforms.find(
        (p) => p.platform === "openai",
      );
      const anthropicPlatform = frameworkQuery.platforms.find(
        (p) => p.platform === "anthropic",
      );
      invariant(openaiPlatform, "OpenAI platform not found");
      invariant(anthropicPlatform, "Anthropic platform not found");

      expect(openaiPlatform.mentionsYourSite).toBe(1);
      expect(openaiPlatform.directCitations).toBe(1);
      expect(openaiPlatform.indirectCitations).toBe(0);
      expect(anthropicPlatform.mentionsYourSite).toBe(1);
      expect(anthropicPlatform.directCitations).toBe(1);
      expect(anthropicPlatform.indirectCitations).toBe(0);
    });

    it("should return citations list", async () => {
      const content = JSON.parse(body.result.content[0].text) as {
        queries: {
          query: string;
          platforms: {
            platform: string;
            citations: {
              url: string;
              relationship?: string;
              reason?: string;
            }[];
          }[];
        }[];
      };

      const nodeQuery = content.queries.find(
        (q) => q.query === "What is Node.js?",
      );
      invariant(nodeQuery, "Node query not found");
      const openaiPlatform = nodeQuery.platforms.find(
        (p) => p.platform === "openai",
      );
      invariant(openaiPlatform, "OpenAI platform not found");

      const citationUrls = openaiPlatform.citations.map((c) => c.url);
      expect(citationUrls).toContain("https://nodejs.org");
      expect(citationUrls).toContain(`https://${CITATIONS_DOMAIN}`);
    });
  });

  describe("with site that has no citation runs", () => {
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
          id: 31,
          method: "tools/call",
          params: {
            name: "get_site_citations",
            arguments: { domain: "mcp-test-site-1.example" },
          },
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

    it("should return empty queries", async () => {
      const content = JSON.parse(body.result.content[0].text) as {
        domain: string;
        date: string | null;
        queries: unknown[];
      };
      expect(content.domain).toBe("mcp-test-site-1.example");
      expect(content.date).toBeNull();
      expect(content.queries).toEqual([]);
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
          id: 32,
          method: "tools/call",
          params: {
            name: "get_site_citations",
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
          id: 33,
          method: "tools/call",
          params: {
            name: "get_site_citations",
            arguments: { domain: CITATIONS_DOMAIN },
          },
        },
      });
    });

    it("should return 401", async () => {
      expect(response.status).toBe(401);
    });
  });
});
