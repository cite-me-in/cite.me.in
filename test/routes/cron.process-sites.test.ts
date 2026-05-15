import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { daysAgo, hoursAgo } from "~/lib/formatDate";
import prisma from "~/lib/prisma.server";
import { port } from "~/test/helpers/launchServer";

vi.mock("~/lib/envVars.server", () => ({
  default: { CRON_SECRET: "test-cron-secret" },
}));

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
      await prisma.site.deleteMany();
      await prisma.user.deleteMany();
    });

    it("should process a paid site never processed before (lastProcessedAt null)", async () => {
      await prisma.site.create({
        data: {
          content: "Test content",
          domain: "paid-site.example.com",
          summary: "Test summary",
          lastProcessedAt: null,
          owner: {
            create: {
              email: "owner-process1@test.com",
              passwordHash: "test",
              plan: "paid",
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
          content: "Test content",
          domain: "paid-site.example.com",
          summary: "Test summary",
          lastProcessedAt: daysAgo(2),
          owner: {
            create: {
              email: "owner-process1@test.com",
              passwordHash: "test",
              plan: "paid",
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
          content: "Test content",
          domain: "paid-site.example.com",
          summary: "Test summary",
          lastProcessedAt: hoursAgo(8),
          owner: {
            create: {
              email: "owner-process1@test.com",
              passwordHash: "test",
              plan: "paid",
            },
          },
        },
      });
      const results = await makeRequest("test-cron-secret");
      expect(
        results.find((r) => r.domain === "paid-site.example.com"),
      ).toBeUndefined();
    });

    it("should process a trial site created today (lastProcessedAt null)", async () => {
      await prisma.site.create({
        data: {
          content: "Test content",
          domain: "free-trial.example.com",
          summary: "Test summary",
          lastProcessedAt: null,
          owner: {
            create: {
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
          content: "Test content",
          domain: "free-trial.example.com",
          summary: "Test summary",
          lastProcessedAt: daysAgo(6),
          owner: {
            create: {
              email: "owner-process2@test.com",
              passwordHash: "test",
            },
          },
        },
      });
      const results = await makeRequest("test-cron-secret");
      expect(
        results.find((r) => r.domain === "free-trial.example.com"),
      ).toBeUndefined();
    });

    it("should skip a trial site older than 25 days", async () => {
      await prisma.site.create({
        data: {
          content: "Test content",
          domain: "old-free.example.com",
          summary: "Test summary",
          owner: {
            create: {
              email: "owner-process3@test.com",
              passwordHash: "test",
              createdAt: daysAgo(26),
            },
          },
        },
      });
      const results = await makeRequest("test-cron-secret");
      expect(
        results.find((r) => r.domain === "old-free.example.com"),
      ).toBeUndefined();
    });

    it("should process a gratis site not processed in 24 hours", async () => {
      await prisma.site.create({
        data: {
          content: "Test content",
          domain: "gratis-site.example.com",
          summary: "Test summary",
          lastProcessedAt: hoursAgo(25),
          owner: {
            create: {
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
          content: "Test content",
          domain: "cancelled-site.example.com",
          summary: "Test summary",
          owner: {
            create: {
              email: "owner-process6@test.com",
              passwordHash: "test",
              plan: "cancelled",
            },
          },
        },
      });
      const results = await makeRequest("test-cron-secret");
      expect(
        results.find((r) => r.domain === "cancelled-site.example.com"),
      ).toBeUndefined();
    });
  });

  describe("trial emails", () => {
    beforeEach(async () => {
      await prisma.user.deleteMany({
        where: { email: { contains: "trial-email" } },
      });
    });

    it("should not send TrialEnding if TrialEnded already sent", async () => {
      const user = await prisma.user.create({
        data: {
          email: "trial-email-ending-skip@test.com",
          passwordHash: "test",
          createdAt: daysAgo(25),
          sentEmails: { create: { type: "TrialEnded" } },
          ownedSites: {
            create: {
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
          email: "trial-email-ending@test.com",
          passwordHash: "test",
          createdAt: daysAgo(24),
          ownedSites: {
            create: {
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
          email: "trial-email-ended@test.com",
          passwordHash: "test",
          createdAt: daysAgo(26),
          ownedSites: {
            create: {
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
