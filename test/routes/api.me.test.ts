import { beforeAll, describe, expect, it } from "vitest";
import prisma from "~/lib/prisma.server";
import { port } from "~/test/helpers/launchBrowser";

const BASE = `http://localhost:${port}`;
const USER_ID = "user1";
const API_KEY = `cite.me.in_${USER_ID}_sitesroutetestkey123456`;
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
              id: RUN_ID,
              platform: "chatgpt",
              model: "gpt-4o",
              onDate: new Date().toISOString().split("T")[0],
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
            },
          },
        },
      },
    },
    update: { apiKey: API_KEY },
  });
});

describe("GET /api/me", () => {
  it("should return 401 without a token", async () => {
    const res = await get("/api/me");
    expect(res.status).toBe(401);
  });

  it("should return 403 for an unknown token", async () => {
    const res = await get("/api/me", "cite.me.in_nonexistent_wrongsecret1234");
    expect(res.status).toBe(403);
  });

  describe("with a correct token", () => {
    let response: Response;
    let body: {
      email: string;
      sites: { domain: string; createdAt: string }[];
    };

    beforeAll(async () => {
      response = await get("/api/me", API_KEY);
      body = await response.json();
    });

    it("should return 200", async () => {
      expect(response.status).toBe(200);
    });

    it("should return the user with their sites", async () => {
      expect(body.email).toBe(EMAIL);
      expect(Array.isArray(body.sites)).toBe(true);
      expect(body.sites[0].domain).toBe(DOMAIN);
      expect(body.sites[0].createdAt).toBe(
        new Date().toISOString().split("T")[0],
      );
    });
  });
});
