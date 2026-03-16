import { beforeAll, describe, expect, it } from "vitest";
import prisma from "~/lib/prisma.server";
import { port } from "~/test/helpers/launchBrowser";

const BASE_URL = `http://localhost:${port}/api/track`;

async function post(body: unknown, headers: Record<string, string> = {}) {
  return await fetch(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function authHeader() {
  return { Authorization: "Bearer test-api-key-apitrack-1" };
}

describe("api.track", () => {
  beforeAll(async () => {
    await prisma.user.create({
      data: {
        id: "user-apitrack-1",
        email: "apitrack@test.com",
        passwordHash: "test",
        ownedSites: {
          create: {
            id: "site-apitrack-1",
            domain: "apitrack.example.com",
            apiKey: "test-api-key-apitrack-1",
          },
        },
      },
    });

    await prisma.user.create({
      data: {
        id: "user-apitrack-2",
        email: "apitrack2@test.com",
        passwordHash: "test",
        ownedSites: {
          create: {
            id: "site-apitrack-2",
            domain: "other-apitrack.example.com",
            apiKey: "test-api-key-apitrack-2",
          },
        },
      },
    });
  });

  describe("method handling", () => {
    it("should return 405 for GET", async () => {
      const res = await fetch(BASE_URL);
      expect(res.status).toBe(405);
    });
  });

  describe("validation", () => {
    it("should return 400 for invalid JSON", async () => {
      const res = await fetch(BASE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      });
      expect(res.status).toBe(400);
    });

    it("should return 400 when url is missing", async () => {
      const res = await post({
        userAgent: "Googlebot/2.1",
        accept: "text/html",
        ip: "1.2.3.4",
      });
      expect(res.status).toBe(400);
    });
  });

  describe("tracking", () => {
    it("should include CORS headers in response", async () => {
      const res = await post(
        {
          url: "https://apitrack.example.com/",
          userAgent: "GPTBot/1.0",
          accept: "text/html",
          ip: "1.2.3.4",
        },
        authHeader(),
      );
      expect(res.headers.get("access-control-allow-origin")).toBe("*");
    });

    it("should track a human browser visit", async () => {
      await prisma.humanVisit.deleteMany();
      const res = await post(
        {
          url: "https://apitrack.example.com/",
          userAgent:
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
          accept: "text/html",
          ip: "1.2.3.4",
        },
        authHeader(),
      );
      expect(res.status).toBe(200);
      await expect(prisma.humanVisit.findFirst()).resolves.not.toBeNull();
    });

    it("should return 403 when domain is not in the account", async () => {
      const res = await post(
        {
          url: "https://unknown-domain-xyz.example.com/",
          userAgent: "GPTBot/1.0",
          accept: "text/html",
          ip: "1.2.3.4",
        },
        authHeader(),
      );
      expect(res.status).toBe(403);
    });

    it("should track a bot visit for a known domain", async () => {
      await prisma.botVisit.deleteMany();
      const res = await post(
        {
          url: "https://apitrack.example.com/about",
          userAgent: "GPTBot/1.0",
          accept: "text/html, text/plain",
          ip: "1.2.3.4",
          referer: "https://chatgpt.com",
        },
        authHeader(),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);

      const record = await prisma.botVisit.findFirst({
        where: { siteId: "site-apitrack-1", path: "/about" },
      });
      expect(record).not.toBeNull();
      expect(record?.botType).toBe("ChatGPT");
      expect(record?.userAgent).toBe("GPTBot/1.0");
      expect(record?.count).toBe(1);
    });

    it("should increment count on repeated visit", async () => {
      await post(
        {
          url: "https://apitrack.example.com/repeated",
          userAgent: "PerplexityBot/1.0",
          accept: "text/html",
          ip: "1.2.3.4",
        },
        authHeader(),
      );
      await post(
        {
          url: "https://apitrack.example.com/repeated",
          userAgent: "PerplexityBot/1.0",
          accept: "text/html",
          ip: "1.2.3.4",
        },
        authHeader(),
      );

      const record = await prisma.botVisit.findFirst({
        where: { siteId: "site-apitrack-1", path: "/repeated" },
      });
      expect(record?.count).toBe(2);
    });
  });

  describe("auth", () => {
    it("should return 403 when Authorization header is missing", async () => {
      const res = await post({
        url: "https://apitrack.example.com/",
        userAgent: "GPTBot/1.0",
      });
      expect(res.status).toBe(403);
    });

    it("should return 403 when API key is wrong", async () => {
      const res = await post(
        { url: "https://apitrack.example.com/", userAgent: "GPTBot/1.0" },
        { Authorization: "Bearer wrong-key" },
      );
      expect(res.status).toBe(403);
    });

    it("should return 403 when domain belongs to a different account", async () => {
      const res = await post(
        { url: "https://other-apitrack.example.com/", userAgent: "GPTBot/1.0" },
        authHeader(),
      );
      expect(res.status).toBe(403);
    });

    it("should return 200 with valid key and matching domain", async () => {
      const res = await post(
        {
          url: "https://apitrack.example.com/auth-test",
          userAgent: "GPTBot/1.0",
        },
        authHeader(),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
    });
  });
});
