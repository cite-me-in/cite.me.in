import { beforeEach, describe, expect, it } from "vitest";
import { Temporal } from "@js-temporal/polyfill";
import { port } from "../helpers/launchBrowser";
import prisma from "~/lib/prisma.server";

async function makeRequest(auth?: string) {
  const response = await fetch(`http://localhost:${port}/cron/process-sites`, {
    headers: { authorization: `Bearer ${auth}` },
  });
  expect(response.status).toBe(200);

  const { ok, results } = (await response.json()) as {
    ok: boolean;
    results: { emailIds: string[]; domain: string; skipped: boolean }[];
  };
  expect(ok).toBe(true);

  return results;
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
  });

  describe("site processing", () => {
    beforeEach(async () => {
      await prisma.user.deleteMany();
    });

    it("should process a paid site that was processed more than 7 days ago", async () => {
      await prisma.site.create({
        data: {
          apiKey: "test-api-key-process-1",
          content: "Test content",
          domain: "paid-site.example.com",
          id: "site-process-1",
          summary: "Test summary",
          digestSentAt: new Date(
            Temporal.Now.instant().subtract({ hours: 24 * 8 })
              .epochMilliseconds,
          ),
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

      const results = await makeRequest("test-cron-secret");
      expect(results.length).toBe(1);
    });

    it("should skip a paid site that was processed in the last 7 days", async () => {
      await prisma.site.create({
        data: {
          apiKey: "test-api-key-process-1",
          content: "Test content",
          domain: "paid-site.example.com",
          id: "site-process-1",
          summary: "Test summary",
          digestSentAt: new Date(
            Temporal.Now.instant().subtract({ hours: 24 * 3 })
              .epochMilliseconds,
          ),
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

      const results = await makeRequest("test-cron-secret");
      expect(results.length).toBe(0);
    });

    it("should process a free trial site (created today)", async () => {
      await prisma.site.create({
        data: {
          apiKey: "test-api-key-process-2",
          content: "Test content",
          domain: "free-trial.example.com",
          id: "site-process-2",
          summary: "Test summary",
          owner: {
            create: {
              id: "user-process-2",
              email: "owner-process2@test.com",
              passwordHash: "test",
            },
          },
        },
      });

      const results = await makeRequest("test-cron-secret");
      expect(results.length).toBe(0);
    });

    it("should skip a free site older than 25 days", async () => {
      const twentyFiveDaysAgo = new Date(
        Temporal.Now.instant().subtract({ hours: 24 * 26 }).epochMilliseconds,
      );
      await prisma.site.create({
        data: {
          apiKey: "test-api-key-process-3",
          content: "Test content",
          domain: "old-free.example.com",
          id: "site-process-3",
          summary: "Test summary",
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

      const results = await makeRequest("test-cron-secret");
      expect(results.length).toBe(0);
    });

    it("should skip a site with a citation run recently", async () => {
      await prisma.site.create({
        data: {
          apiKey: "test-api-key-process-4",
          content: "Test content",
          domain: "recent-run.example.com",
          id: "site-process-4",
          summary: "Test summary",
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

      const results = await makeRequest("test-cron-secret");
      expect(results.length).toBe(0);
    });
  });

  describe("trial emails", () => {
    beforeEach(async () => {
      await prisma.user.deleteMany({ where: { email: { contains: "trial-email" } } });
    });

    it("should send TrialEnded email once and not again", async () => {
      const user = await prisma.user.create({
        data: {
          id: "user-trial-email-1",
          email: "trial-email-ended@test.com",
          passwordHash: "test",
          createdAt: new Date(
            Temporal.Now.instant().subtract({ hours: 24 * 26 }).epochMilliseconds,
          ),
          ownedSites: {
            create: {
              id: "site-trial-email-1",
              apiKey: "test-api-key-trial-email-1",
              content: "Test content",
              domain: "trial-ended.example.com",
              summary: "Test summary",
            },
          },
        },
      });

      await makeRequest("test-cron-secret");

      const after1 = await prisma.sentEmail.findMany({
        where: { userId: user.id, type: "TrialEnded" },
      });
      expect(after1.length).toBe(1);

      await makeRequest("test-cron-secret");

      const after2 = await prisma.sentEmail.findMany({
        where: { userId: user.id, type: "TrialEnded" },
      });
      expect(after2.length).toBe(1);
    });
  });
});
