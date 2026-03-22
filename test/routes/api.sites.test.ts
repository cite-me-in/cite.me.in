import { beforeAll, describe, expect, it } from "vitest";
import prisma from "~/lib/prisma.server";
import { port } from "~/test/helpers/launchBrowser";

const BASE = `http://localhost:${port}`;
const API_KEY = "cite.me.in_sites_route_test_key";
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
    where: { id: "api-sites-route-user-1" },
    create: {
      id: "api-sites-route-user-1",
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
                  position: 1,
                  citations: [
                    `https://${DOMAIN}/page1`,
                    `https://${DOMAIN}/page2`,
                  ],
                },
              },
            },
          },
        },
      },
    },
    update: { apiKey: API_KEY },
  });
});

describe("GET /api/sites/:domain", () => {
  it("should return 401 without a token", async () => {
    const res = await get(`/api/sites/${DOMAIN}`);
    expect(res.status).toBe(401);
  });

  it("should return 404 for a domain the user doesn't own", async () => {
    const res = await get("/api/sites/not-owned.example", API_KEY);
    expect(res.status).toBe(404);
  });

  it("should return the site with users and roles", async () => {
    const res = await get(`/api/sites/${DOMAIN}`, API_KEY);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.domain).toBe(DOMAIN);
    expect(body.createdAt).toBe(new Date().toISOString().split("T")[0]);
    expect(Array.isArray(body.users)).toBe(true);
    expect(body.users[0].email).toBe("api-sites-route@test.example");
    expect(body.users[0].role).toBe("owner");
  });
});

describe("GET /api/sites/:domain/runs", () => {
  it("should return 401 without a token", async () => {
    const res = await get(`/api/sites/${DOMAIN}/runs`);
    expect(res.status).toBe(401);
  });

  it("should return runs with summary counts", async () => {
    const res = await get(`/api/sites/${DOMAIN}/runs`, API_KEY);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.runs)).toBe(true);
    const run = body.runs.find((r: { id: string }) => r.id === RUN_ID);
    expect(run).toBeDefined();
    expect(run.platform).toBe("chatgpt");
    expect(run.queryCount).toBe(1);
    expect(run.citationCount).toBe(2);
  });

  it("should return empty list for a future ?since= date", async () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const res = await get(`/api/sites/${DOMAIN}/runs?since=${future}`, API_KEY);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.runs).toHaveLength(0);
  });
});

describe("GET /api/sites/:domain/runs/:runId", () => {
  it("should return 401 without a token", async () => {
    const res = await get(`/api/sites/${DOMAIN}/runs/${RUN_ID}`);
    expect(res.status).toBe(401);
  });

  it("should return 404 for an unknown runId", async () => {
    const res = await get(`/api/sites/${DOMAIN}/runs/nonexistent`, API_KEY);
    expect(res.status).toBe(404);
  });

  it("should return the run detail with queries and citations", async () => {
    const res = await get(`/api/sites/${DOMAIN}/runs/${RUN_ID}`, API_KEY);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(RUN_ID);
    expect(body.platform).toBe("chatgpt");
    expect(Array.isArray(body.queries)).toBe(true);
    expect(body.queries[0].query).toBe("best retail platforms");
    expect(body.queries[0].citations).toEqual([
      `https://${DOMAIN}/page1`,
      `https://${DOMAIN}/page2`,
    ]);
  });
});
