import { beforeEach, describe, expect, it } from "vitest";
import prisma from "~/lib/prisma.server";
import { generateUnsubscribeToken } from "~/lib/weeklyDigest.server";
import { port } from "../helpers/launchBrowser";

async function makeRequest(auth?: string) {
  return await fetch(`http://localhost:${port}/cron/weekly-digest`, {
    headers: { authorization: `Bearer ${auth}` },
  });
}

describe("cron.weekly-digest", () => {
  beforeEach(async () => {
    await prisma.user.deleteMany({
      where: { email: { contains: "digest" } },
    });
  });

  describe("auth", () => {
    it("should return 401 without Authorization header", async () => {
      const res = await fetch(`http://localhost:${port}/cron/weekly-digest`);
      expect(res.status).toBe(401);
    });

    it("should return 401 with wrong token", async () => {
      const res = await makeRequest("wrong-token");
      expect(res.status).toBe(401);
    });

    it("should return 200 with correct token", async () => {
      const res = await makeRequest("test-cron-secret");
      expect(res.status).toBe(200);
    });
  });

  describe("results", () => {
    it("should return empty results when no sites exist", async () => {
      const res = await makeRequest("test-cron-secret");
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.results).toHaveLength(0);
    });

    it("should send email to site owner", async () => {
      await prisma.site.create({
        data: {
          id: "site-digest-1",
          domain: "digest-owner.example.com",
          apiKey: "test-api-key-digest-1",
          owner: {
            create: {
              id: "user-digest-1",
              email: "owner-digest@test.com",
              passwordHash: "test",
              weeklyDigestEnabled: true,
            },
          },
        },
      });

      const res = await makeRequest("test-cron-secret");
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.results).toHaveLength(1);
      expect(body.results[0].siteId).toBe("site-digest-1");
      expect(body.results[0].sent).toBe(1);
    });

    it("should send email to owner and site member", async () => {
      await prisma.user.create({
        data: {
          id: "user-digest-2",
          email: "owner2-digest@test.com",
          passwordHash: "test",
          weeklyDigestEnabled: true,
        },
      });
      await prisma.user.create({
        data: {
          id: "user-digest-3",
          email: "member-digest@test.com",
          passwordHash: "test",
          weeklyDigestEnabled: true,
        },
      });
      await prisma.site.create({
        data: {
          id: "site-digest-2",
          domain: "digest-members.example.com",
          apiKey: "test-api-key-digest-2",
          ownerId: "user-digest-2",
          siteUsers: {
            create: { userId: "user-digest-3" },
          },
        },
      });

      const res = await makeRequest("test-cron-secret");
      const body = await res.json();
      const result = body.results.find(
        (r: { siteId: string }) => r.siteId === "site-digest-2",
      );
      expect(result?.sent).toBe(2);
    });

    it("should skip users with weeklyDigestEnabled=false", async () => {
      await prisma.site.create({
        data: {
          id: "site-digest-3",
          domain: "digest-unsubscribed.example.com",
          apiKey: "test-api-key-digest-3",
          owner: {
            create: {
              id: "user-digest-4",
              email: "unsub-digest@test.com",
              passwordHash: "test",
              weeklyDigestEnabled: false,
            },
          },
        },
      });

      const res = await makeRequest("test-cron-secret");
      const body = await res.json();
      const result = body.results.find(
        (r: { siteId: string }) => r.siteId === "site-digest-3",
      );
      expect(result?.sent).toBe(0);
    });
  });

  describe("unsubscribe route", () => {
    it("should set weeklyDigestEnabled=false with valid token", async () => {
      await prisma.user.create({
        data: {
          id: "user-digest-5",
          email: "unsub2-digest@test.com",
          passwordHash: "test",
          weeklyDigestEnabled: true,
        },
      });

      const token = generateUnsubscribeToken("user-digest-5");
      const res = await fetch(
        `http://localhost:${port}/unsubscribe?token=${token}&user=user-digest-5`,
      );
      expect(res.status).toBe(200);

      const updated = await prisma.user.findUnique({
        where: { id: "user-digest-5" },
        select: { weeklyDigestEnabled: true },
      });
      expect(updated?.weeklyDigestEnabled).toBe(false);
    });

    it("should return 400 with invalid token", async () => {
      await prisma.user.create({
        data: {
          id: "user-digest-6",
          email: "unsub3-digest@test.com",
          passwordHash: "test",
          weeklyDigestEnabled: true,
        },
      });

      const res = await fetch(
        `http://localhost:${port}/unsubscribe?token=invalid-token&user=user-digest-6`,
      );
      expect(res.status).toBe(400);
    });
  });
});
