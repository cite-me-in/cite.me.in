import { beforeAll, describe, expect, it } from "vitest";
import { port } from "~/test/helpers/launchBrowser";
import prisma from "~/lib/prisma.server";

const BASE = `http://localhost:${port}`;
const USER_ID = "user1";
const API_KEY = `cite.me.in_${USER_ID}_secret123456`;
const DOMAIN = "api-sites-route-test.example";
const EMAIL = "api-sites-route@test.example";
const RUN_ID = "api-sites-route-run-1";

function get(path: string, token?: string) {
  return fetch(`${BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

beforeAll(async () => {
  await prisma.user.upsert({
    where: { id: USER_ID },
    create: {
      id: USER_ID,
      email: EMAIL,
      passwordHash: "test",
      apiKey: API_KEY,
      ownedSites: {
        create: {
          content: "Test content",
          domain: DOMAIN,
          summary: "Test summary",
          citationRuns: {
            create: {
              onDate: new Date().toISOString().split("T")[0],
              id: RUN_ID,
              platform: "chatgpt",
              model: "gpt-4o",
              queries: {
                create: {
                  query: "best retail platforms",
                  group: "retail",
                  extraQueries: [],
                  text: "Some answer",
                  citations: [
                    `https://${DOMAIN}/page1`,
                    `https://${DOMAIN}/page2`,
                  ],
                },
              },
              sentimentLabel: "positive",
              sentimentSummary:
                "Rentail.space is cited positively across multiple queries, frequently appearing as a top recommendation for finding short-term retail space. It ranks prominently in citations and is described as a reliable marketplace for pop-up and kiosk leasing.",
            },
          },
        },
      },
    },
    update: { apiKey: API_KEY },
  });
});

describe("GET /api/site/:domain", () => {
  it("should return 401 without a token", async () => {
    const response = await get(`/api/site/${DOMAIN}`);
    expect(response.status).toBe(401);
  });

  it("should return 404 for a domain that doesn't exist", async () => {
    const response = await get("/api/site/not-owned.example", API_KEY);
    expect(response.status).toBe(404);
  });

  describe("with a correct token", () => {
    let response: Response;
    let body: {
      domain: string;
      createdAt: string;
      content: string;
      summary: string;
      users: { email: string; role: string }[];
    };

    beforeAll(async () => {
      response = await get(`/api/site/${DOMAIN}`, API_KEY);
      body = await response.json();
    });

    it("should return 200", async () => {
      expect(response.status).toBe(200);
    });

    it("should return the site with users and roles", async () => {
      expect(body.domain).toBe(DOMAIN);
      expect(body.createdAt).toBe(new Date().toISOString().split("T")[0]);
      expect(Array.isArray(body.users)).toBe(true);
    });

    it("should return the site with summary", async () => {
      expect(body.summary).toBe("Test summary");
    });
  });
});

describe("GET /api/site/:domain/metrics", () => {
  it("should return 401 without a token", async () => {
    const res = await get(`/api/site/${DOMAIN}/metrics`);
    expect(res.status).toBe(401);
  });

  it("should return 404 for a domain that doesn't exist", async () => {
    const res = await get("/api/site/nonexistent.example/metrics", API_KEY);
    expect(res.status).toBe(404);
  });

  it("should return metrics with summary counts", async () => {
    const res = await get(`/api/site/${DOMAIN}/metrics`, API_KEY);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.allCitations.current).toBe(2);
    expect(body.allCitations.previous).toBe(0);
    expect(body.yourCitations.current).toBe(2);
    expect(body.yourCitations.previous).toBe(0);
    expect(body.visbilityScore.current).toBe(70);
    expect(body.visbilityScore.previous).toBe(0);
    expect(body.botVisits.current).toBe(0);
    expect(body.botVisits.previous).toBe(0);
  });
});

describe("GET /api/site/:domain/queries", () => {
  it("should return 401 without a token", async () => {
    const res = await get(`/api/site/${DOMAIN}/queries`);
    expect(res.status).toBe(401);
  });

  it("should return 404 for a domain that doesn't exist", async () => {
    const res = await get("/api/site/nonexistent.example/queries", API_KEY);
    expect(res.status).toBe(404);
  });

  describe("with a correct token", () => {
    let response: Response;
    let body: {
      platforms: {
        model: string;
        onDate: string;
        platform: string;
        queries: { query: string; citations: string[] }[];
        sentiment: { label: string; summary: string };
      }[];
    };

    beforeAll(async () => {
      response = await get(`/api/site/${DOMAIN}/queries`, API_KEY);
      body = await response.json();
    });

    it("should return 200", async () => {
      expect(response.status).toBe(200);
    });

    it("should return the queries with citations", async () => {
      expect(Array.isArray(body.platforms)).toBe(true);
      expect(body.platforms[0].model).toBe("gpt-4o");
      expect(body.platforms[0].onDate).toBe(
        new Date().toISOString().split("T")[0],
      );
      expect(body.platforms[0].platform).toBe("chatgpt");
      expect(Array.isArray(body.platforms[0].queries)).toBe(true);
      expect(body.platforms[0].queries[0].query).toBe("best retail platforms");
      expect(body.platforms[0].queries[0].citations).toEqual([
        `https://${DOMAIN}/page1`,
        `https://${DOMAIN}/page2`,
      ]);
    });

    it("should return the queries with sentiment", async () => {
      expect(body.platforms[0].sentiment.label).toBe("positive");
      expect(body.platforms[0].sentiment.summary).toBe(
        "Rentail.space is cited positively across multiple queries, frequently appearing as a top recommendation for finding short-term retail space. It ranks prominently in citations and is described as a reliable marketplace for pop-up and kiosk leasing.",
      );
    });
  });
});
