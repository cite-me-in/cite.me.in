import { beforeAll, describe, expect, it } from "vitest";
import prisma from "~/lib/prisma.server";
import { port } from "~/test/helpers/launchBrowser";

const BASE_URL = `http://localhost:${port}/api/track`;

function post(body: unknown) {
  return fetch(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("api.track", () => {
  beforeAll(async () => {
    await prisma.account.create({
      data: {
        id: "account-apitrack-1",
        users: {
          create: {
            id: "user-apitrack-1",
            email: "apitrack@test.com",
            passwordHash: "test",
          },
        },
        sites: {
          create: { id: "site-apitrack-1", domain: "apitrack.example.com" },
        },
      },
    });
  });

  describe("method handling", () => {
    it("returns 405 for GET", async () => {
      const res = await fetch(BASE_URL);
      expect(res.status).toBe(405);
    });
  });

  describe("validation", () => {
    it("returns 400 for invalid JSON", async () => {
      const res = await fetch(BASE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.tracked).toBe(false);
    });

    it("returns 400 when url is missing", async () => {
      const res = await post({
        userAgent: "Googlebot/2.1",
        accept: [],
        ip: "1.2.3.4",
      });
      expect(res.status).toBe(400);
    });

    it("returns 400 when userAgent is missing", async () => {
      const res = await post({
        url: "https://apitrack.example.com/",
        accept: [],
        ip: "1.2.3.4",
      });
      expect(res.status).toBe(400);
    });
  });

  describe("tracking", () => {
    it("includes CORS headers in response", async () => {
      const res = await post({
        url: "https://apitrack.example.com/",
        userAgent: "GPTBot/1.0",
        accept: [],
        ip: "1.2.3.4",
      });
      expect(res.headers.get("access-control-allow-origin")).toBe("*");
    });

    it("does not track a regular browser visit", async () => {
      const res = await post({
        url: "https://apitrack.example.com/",
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        accept: "text/html",
        ip: "1.2.3.4",
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.tracked).toBe(false);
      expect(body.reason).toBe("not a bot");
    });

    it("returns tracked:false when domain is unknown", async () => {
      const res = await post({
        url: "https://unknown-domain-xyz.example.com/",
        userAgent: "GPTBot/1.0",
        accept: "text/html",
        ip: "1.2.3.4",
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.tracked).toBe(false);
      expect(body.reason).toBe("site not found");
    });

    it("tracks a bot visit for a known domain", async () => {
      const res = await post({
        url: "https://apitrack.example.com/about",
        userAgent: "GPTBot/1.0",
        accept: "text/html, text/plain",
        ip: "1.2.3.4",
        referer: "https://chatgpt.com",
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.tracked).toBe(true);

      const record = await prisma.botVisit.findFirst({
        where: { siteId: "site-apitrack-1", path: "/about" },
      });
      expect(record).not.toBeNull();
      expect(record?.botType).toBe("ChatGPT");
      expect(record?.userAgent).toBe("GPTBot/1.0");
      expect(record?.count).toBe(1);
    });

    it("increments count on repeated visit", async () => {
      await post({
        url: "https://apitrack.example.com/repeated",
        userAgent: "PerplexityBot/1.0",
        accept: "text/html",
        ip: "1.2.3.4",
      });
      await post({
        url: "https://apitrack.example.com/repeated",
        userAgent: "PerplexityBot/1.0",
        accept: "text/html",
        ip: "1.2.3.4",
      });

      const record = await prisma.botVisit.findFirst({
        where: { siteId: "site-apitrack-1", path: "/repeated" },
      });
      expect(record?.count).toBe(2);
    });
  });
});
