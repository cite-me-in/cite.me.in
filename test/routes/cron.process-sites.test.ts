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

    it("should process a paid site never processed before (lastProcessedAt null)", async () => {
      await prisma.site.create({
        data: {
          apiKey: "test-api-key-process-1",
          content: "Test content",
          domain: "paid-site.example.com",
          id: "site-process-1",
          summary: "Test summary",
          owner: {
            create: {
              id: "user-process-1",
              email: "owner-process1@test.com",
              passwordHash: "test",
              plan: "paid",
              account: {
                create: {
                  stripeCustomerId: "cus_process_test1",
                  stripeSubscriptionId: "sub_process_test1",
                  interval: "monthly",
                },
              },
            },
          },
        },
      });
      const results = await makeRequest("test-cron-secret");
      expect(results.length).toBe(1);
    });

    it("should process a paid site last processed more than 24 hours ago", async () => {
      await prisma.site.create({
        data: {
          apiKey: "test-api-key-process-1",
          content: "Test content",
          domain: "paid-site.example.com",
          id: "site-process-1",
          summary: "Test summary",
          lastProcessedAt: new Date(
            Temporal.Now.instant().subtract({ hours: 25 }).epochMilliseconds,
          ),
          owner: {
            create: {
              id: "user-process-1",
              email: "owner-process1@test.com",
              passwordHash: "test",
              plan: "paid",
              account: {
                create: {
                  stripeCustomerId: "cus_process_test1",
                  stripeSubscriptionId: "sub_process_test1",
                  interval: "monthly",
                },
              },
            },
          },
        },
      });
      const results = await makeRequest("test-cron-secret");
      expect(results.length).toBe(1);
    });

    it("should skip a paid site processed within the last 24 hours", async () => {
      await prisma.site.create({
        data: {
          apiKey: "test-api-key-process-1",
          content: "Test content",
          domain: "paid-site.example.com",
          id: "site-process-1",
          summary: "Test summary",
          lastProcessedAt: new Date(
            Temporal.Now.instant().subtract({ hours: 12 }).epochMilliseconds,
          ),
          owner: {
            create: {
              id: "user-process-1",
              email: "owner-process1@test.com",
              passwordHash: "test",
              plan: "paid",
              account: {
                create: {
                  stripeCustomerId: "cus_process_test1",
                  stripeSubscriptionId: "sub_process_test1",
                  interval: "monthly",
                },
              },
            },
          },
        },
      });
      const results = await makeRequest("test-cron-secret");
      expect(results.length).toBe(0);
    });

    it("should process a trial site created today (lastProcessedAt null)", async () => {
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
      expect(results.length).toBe(1);
    });

    it("should skip a trial site processed within the last 7 days", async () => {
      await prisma.site.create({
        data: {
          apiKey: "test-api-key-process-2",
          content: "Test content",
          domain: "free-trial.example.com",
          id: "site-process-2",
          summary: "Test summary",
          lastProcessedAt: new Date(
            Temporal.Now.instant().subtract({ hours: 24 * 3 }).epochMilliseconds,
          ),
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

    it("should skip a trial site older than 25 days", async () => {
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
              createdAt: new Date(
                Temporal.Now.instant().subtract({ hours: 24 * 26 }).epochMilliseconds,
              ),
            },
          },
        },
      });
      const results = await makeRequest("test-cron-secret");
      expect(results.length).toBe(0);
    });

    it("should process a gratis site not processed in 24 hours", async () => {
      await prisma.site.create({
        data: {
          apiKey: "test-api-key-process-5",
          content: "Test content",
          domain: "gratis-site.example.com",
          id: "site-process-5",
          summary: "Test summary",
          lastProcessedAt: new Date(
            Temporal.Now.instant().subtract({ hours: 25 }).epochMilliseconds,
          ),
          owner: {
            create: {
              id: "user-process-5",
              email: "owner-process5@test.com",
              passwordHash: "test",
              plan: "gratis",
            },
          },
        },
      });
      const results = await makeRequest("test-cron-secret");
      expect(results.length).toBe(1);
    });

    it("should skip a cancelled site", async () => {
      await prisma.site.create({
        data: {
          apiKey: "test-api-key-process-6",
          content: "Test content",
          domain: "cancelled-site.example.com",
          id: "site-process-6",
          summary: "Test summary",
          owner: {
            create: {
              id: "user-process-6",
              email: "owner-process6@test.com",
              passwordHash: "test",
              plan: "cancelled",
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

    it("should not send TrialEnding if TrialEnded already sent", async () => {
      const user = await prisma.user.create({
        data: {
          id: "user-trial-email-2",
          email: "trial-email-ending-skip@test.com",
          passwordHash: "test",
          createdAt: new Date(
            Temporal.Now.instant().subtract({ hours: 24 * 25 }).epochMilliseconds,
          ),
          sentEmails: { create: { type: "TrialEnded" } },
          ownedSites: {
            create: {
              id: "site-trial-email-2",
              apiKey: "test-api-key-trial-email-2",
              content: "Test content",
              domain: "trial-ending-skip.example.com",
              summary: "Test summary",
            },
          },
        },
      });

      await makeRequest("test-cron-secret");

      const records = await prisma.sentEmail.findMany({
        where: { userId: user.id, type: "TrialEnding" },
      });
      expect(records.length).toBe(0);
    });

    it("should send TrialEnding once and not again", async () => {
      const user = await prisma.user.create({
        data: {
          id: "user-trial-email-3",
          email: "trial-email-ending@test.com",
          passwordHash: "test",
          createdAt: new Date(
            Temporal.Now.instant().subtract({ hours: 24 * 24 }).epochMilliseconds,
          ),
          ownedSites: {
            create: {
              id: "site-trial-email-3",
              apiKey: "test-api-key-trial-email-3",
              content: "Test content",
              domain: "trial-ending.example.com",
              summary: "Test summary",
            },
          },
        },
      });

      await makeRequest("test-cron-secret");

      const after1 = await prisma.sentEmail.findMany({
        where: { userId: user.id, type: "TrialEnding" },
      });
      expect(after1.length).toBe(1);

      await makeRequest("test-cron-secret");

      const after2 = await prisma.sentEmail.findMany({
        where: { userId: user.id, type: "TrialEnding" },
      });
      expect(after2.length).toBe(1);
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
