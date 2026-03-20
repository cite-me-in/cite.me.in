import { Temporal } from "@js-temporal/polyfill";
import { beforeEach, describe, expect, it } from "vitest";
import prisma from "~/lib/prisma.server";
import { port } from "../helpers/launchBrowser";

async function makeRequest(auth?: string) {
  return await fetch(`http://localhost:${port}/cron/process-sites`, {
    headers: { authorization: `Bearer ${auth}` },
  });
}

describe("cron.process-sites", () => {
  beforeEach(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: "process" } } });
  });

  describe("auth", () => {
    it("should return 401 without Authorization header", async () => {
      const res = await fetch(`http://localhost:${port}/cron/process-sites`);
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

  describe("site filtering", () => {
    beforeEach(async () => {
      await prisma.user.deleteMany();
    });

    it("should process a paid site with no citation run", async () => {
      await prisma.site.create({
        data: {
          id: "site-process-1",
          domain: "paid-site.example.com",
          apiKey: "test-api-key-process-1",
          owner: {
            create: {
              id: "user-process-1",
              email: "owner-process1@test.com",
              passwordHash: "test",
              account: {
                create: {
                  stripeCustomerId: "cus_process_test1",
                  stripeSubscriptionId: "sub_process_test1",
                  status: "active",
                },
              },
            },
          },
        },
      });

      const res = await makeRequest("test-cron-secret");
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(Array.isArray(body.results)).toBe(true);
      expect(body.results.length).toBe(1);
    });

    it("should process a free trial site (created today)", async () => {
      await prisma.site.create({
        data: {
          id: "site-process-2",
          domain: "free-trial.example.com",
          apiKey: "test-api-key-process-2",
          owner: {
            create: {
              id: "user-process-2",
              email: "owner-process2@test.com",
              passwordHash: "test",
            },
          },
        },
      });

      const res = await makeRequest("test-cron-secret");
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(Array.isArray(body.results)).toBe(true);
      expect(body.results.length).toBe(1);
    });

    it("should skip a free site older than 25 days", async () => {
      const twentyFiveDaysAgo = new Date(
        Temporal.Now.instant().subtract({ hours: 24 * 25 }).epochMilliseconds,
      );
      await prisma.site.create({
        data: {
          id: "site-process-3",
          domain: "old-free.example.com",
          apiKey: "test-api-key-process-3",
          owner: {
            create: {
              id: "user-process-3",
              email: "owner-process3@test.com",
              passwordHash: "test",
              createdAt: twentyFiveDaysAgo,
            },
          },
        },
      });

      const res = await makeRequest("test-cron-secret");
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(Array.isArray(body.results)).toBe(true);
      expect(body.results.length).toBe(0);
    });

    it("should skip a site with a citation run recently", async () => {
      await prisma.site.create({
        data: {
          id: "site-process-4",
          domain: "recent-run.example.com",
          apiKey: "test-api-key-process-4",
          owner: {
            create: {
              id: "user-process-4",
              email: "owner-process4@test.com",
              passwordHash: "test",
              account: {
                create: {
                  stripeCustomerId: "cus_process_test4",
                  stripeSubscriptionId: "sub_process_test4",
                  status: "active",
                },
              },
            },
          },
          citationRuns: {
            create: {
              platform: "chatgpt",
              model: "gpt-4o",
              onDate: new Date().toISOString().split("T")[0],
            },
          },
        },
      });

      const res = await makeRequest("test-cron-secret");
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(Array.isArray(body.results)).toBe(true);
      expect(body.results.length).toBe(0);
    });
  });
});
