import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import prisma from "~/lib/prisma.server";

const mockQueryPlatform = vi.fn<() => void>();
const mockGenerateBotInsight = vi.fn<() => Promise<string>>();
const mockUpsertCitingPages = vi.fn<() => void>();

vi.mock("~/lib/llm-visibility/queryPlatform", () => ({
  queryPlatform: mockQueryPlatform,
}));

vi.mock("~/lib/llm-visibility/generateBotInsight", () => ({
  default: mockGenerateBotInsight,
}));

vi.mock("~/lib/llm-visibility/upsertCitingPages", () => ({
  default: mockUpsertCitingPages,
}));

vi.mock("~/lib/captureAndLogError.server", () => ({
  default: vi.fn<() => void>(),
}));

const fixedNow = new Date("2024-03-15T12:00:00Z");

const daysAgo = (n: number) => new Date(fixedNow.getTime() - n * 24 * 60 * 60 * 1000);

async function createTestUser(data: {
  id: string;
  plan: "trial" | "paid" | "cancelled" | "gratis";
  createdAt?: Date;
}) {
  return prisma.user.create({
    data: {
      id: data.id,
      email: `${data.id}@test.com`,
      passwordHash: "test",
      plan: data.plan,
      createdAt: data.createdAt ?? new Date(),
    },
  });
}

async function createTestSite(data: {
  id: string;
  domain: string;
  ownerId: string;
  lastProcessedAt?: Date | null;
  summary?: string;
}) {
  return prisma.site.create({
    data: {
      id: data.id,
      domain: data.domain,
      apiKey: `key-${data.id}`,
      content: "test content",
      summary: data.summary ?? "test summary",
      ownerId: data.ownerId,
      lastProcessedAt: data.lastProcessedAt ?? null,
    },
  });
}

async function createTestSiteQuery(data: { siteId: string; query: string; group: string }) {
  return prisma.siteQuery.create({
    data: {
      siteId: data.siteId,
      query: data.query,
      group: data.group,
    },
  });
}

async function createTestBotVisit(data: {
  siteId: string;
  botType: string;
  path: string;
  count: number;
  date: Date;
  userAgent?: string;
}) {
  return prisma.botVisit.create({
    data: {
      siteId: data.siteId,
      botClass: "training",
      botType: data.botType,
      path: data.path,
      count: data.count,
      date: data.date,
      userAgent: data.userAgent ?? "test-user-agent",
    },
  });
}

describe("prepareSites", () => {
  beforeAll(async () => {
    vi.setSystemTime(fixedNow);
  });

  afterAll(async () => {
    vi.useRealTimers();
  });

  beforeEach(async () => {
    mockQueryPlatform.mockReset().mockResolvedValue(undefined);
    mockGenerateBotInsight.mockReset().mockResolvedValue("Test bot insight content");
    mockUpsertCitingPages.mockReset().mockResolvedValue(undefined);

    await prisma.botVisit.deleteMany();
    await prisma.siteQuery.deleteMany();
    await prisma.citation.deleteMany();
    await prisma.citationQueryRun.deleteMany();
    await prisma.site.deleteMany();
    await prisma.user.deleteMany();
  });

  describe("site selection", () => {
    it("should select paid sites with lastProcessedAt null", async () => {
      const user = await createTestUser({ id: "u1", plan: "paid" });
      await createTestSite({
        id: "s1",
        domain: "paid-null.com",
        ownerId: user.id,
      });

      const prepareSites = (await import("~/lib/prepareSites.server")).default;
      const result = await prepareSites({ log: vi.fn<() => void>() });

      expect(result).toHaveLength(1);
      expect(result[0].domain).toBe("paid-null.com");
    });

    it("should select paid sites with lastProcessedAt older than 24 hours", async () => {
      const user = await createTestUser({ id: "u2", plan: "paid" });
      await createTestSite({
        id: "s2",
        domain: "paid-old.com",
        ownerId: user.id,
        lastProcessedAt: daysAgo(2),
      });

      const prepareSites = (await import("~/lib/prepareSites.server")).default;
      const result = await prepareSites({ log: vi.fn<() => void>() });

      expect(result).toHaveLength(1);
      expect(result[0].domain).toBe("paid-old.com");
    });

    it("should not select paid sites processed within last 24 hours", async () => {
      const user = await createTestUser({ id: "u3", plan: "paid" });
      await createTestSite({
        id: "s3",
        domain: "paid-recent.com",
        ownerId: user.id,
        lastProcessedAt: daysAgo(0.5),
      });

      const prepareSites = (await import("~/lib/prepareSites.server")).default;
      const result = await prepareSites({ log: vi.fn<() => void>() });

      expect(result).toHaveLength(0);
    });

    it("should select gratis sites with lastProcessedAt null", async () => {
      const user = await createTestUser({ id: "u4", plan: "gratis" });
      await createTestSite({
        id: "s4",
        domain: "gratis-null.com",
        ownerId: user.id,
      });

      const prepareSites = (await import("~/lib/prepareSites.server")).default;
      const result = await prepareSites({ log: vi.fn<() => void>() });

      expect(result).toHaveLength(1);
      expect(result[0].domain).toBe("gratis-null.com");
    });

    it("should select trial sites with lastProcessedAt null if account < 25 days old", async () => {
      const user = await createTestUser({
        id: "u5",
        plan: "trial",
        createdAt: daysAgo(10),
      });
      await createTestSite({
        id: "s5",
        domain: "trial-new.com",
        ownerId: user.id,
      });

      const prepareSites = (await import("~/lib/prepareSites.server")).default;
      const result = await prepareSites({ log: vi.fn<() => void>() });

      expect(result).toHaveLength(1);
      expect(result[0].domain).toBe("trial-new.com");
    });

    it("should select trial sites with lastProcessedAt older than 7 days if account < 25 days old", async () => {
      const user = await createTestUser({
        id: "u6",
        plan: "trial",
        createdAt: daysAgo(15),
      });
      await createTestSite({
        id: "s6",
        domain: "trial-old.com",
        ownerId: user.id,
        lastProcessedAt: daysAgo(8),
      });

      const prepareSites = (await import("~/lib/prepareSites.server")).default;
      const result = await prepareSites({ log: vi.fn<() => void>() });

      expect(result).toHaveLength(1);
      expect(result[0].domain).toBe("trial-old.com");
    });

    it("should not select trial sites if account >= 25 days old", async () => {
      const user = await createTestUser({
        id: "u7",
        plan: "trial",
        createdAt: daysAgo(30),
      });
      await createTestSite({
        id: "s7",
        domain: "trial-expired.com",
        ownerId: user.id,
      });

      const prepareSites = (await import("~/lib/prepareSites.server")).default;
      const result = await prepareSites({ log: vi.fn<() => void>() });

      expect(result).toHaveLength(0);
    });

    it("should not select trial sites processed within last 7 days", async () => {
      const user = await createTestUser({
        id: "u8",
        plan: "trial",
        createdAt: daysAgo(10),
      });
      await createTestSite({
        id: "s8",
        domain: "trial-recent.com",
        ownerId: user.id,
        lastProcessedAt: daysAgo(3),
      });

      const prepareSites = (await import("~/lib/prepareSites.server")).default;
      const result = await prepareSites({ log: vi.fn<() => void>() });

      expect(result).toHaveLength(0);
    });

    it("should never select cancelled sites", async () => {
      const user = await createTestUser({ id: "u9", plan: "cancelled" });
      await createTestSite({
        id: "s9",
        domain: "cancelled.com",
        ownerId: user.id,
      });

      const prepareSites = (await import("~/lib/prepareSites.server")).default;
      const result = await prepareSites({ log: vi.fn<() => void>() });

      expect(result).toHaveLength(0);
    });

    it("should respect maxSites parameter", async () => {
      const user = await createTestUser({ id: "u10", plan: "paid" });
      await createTestSite({
        id: "s10a",
        domain: "max1.com",
        ownerId: user.id,
      });
      await createTestSite({
        id: "s10b",
        domain: "max2.com",
        ownerId: user.id,
      });
      await createTestSite({
        id: "s10c",
        domain: "max3.com",
        ownerId: user.id,
      });

      const prepareSites = (await import("~/lib/prepareSites.server")).default;
      const result = await prepareSites({
        log: vi.fn<() => void>(),
        maxSites: 2,
      });

      expect(result).toHaveLength(2);
    });

    it("should filter by domain when provided", async () => {
      const user = await createTestUser({ id: "u11", plan: "paid" });
      await createTestSite({
        id: "s11a",
        domain: "filter-a.com",
        ownerId: user.id,
      });
      await createTestSite({
        id: "s11b",
        domain: "filter-b.com",
        ownerId: user.id,
      });

      const prepareSites = (await import("~/lib/prepareSites.server")).default;
      const result = await prepareSites({
        log: vi.fn<() => void>(),
        domain: "filter-b.com",
      });

      expect(result).toHaveLength(1);
      expect(result[0].domain).toBe("filter-b.com");
    });
  });

  describe("processing", () => {
    it("should call queryPlatform for each platform", async () => {
      const user = await createTestUser({ id: "u20", plan: "paid" });
      const site = await createTestSite({
        id: "s20",
        domain: "process1.com",
        ownerId: user.id,
      });
      await createTestSiteQuery({
        siteId: site.id,
        query: "test query",
        group: "1. discovery",
      });

      const prepareSites = (await import("~/lib/prepareSites.server")).default;
      await prepareSites({ log: vi.fn<() => void>() });

      expect(mockQueryPlatform).toHaveBeenCalled();
    });

    it("should call generateBotInsight and create bot insight", async () => {
      const user = await createTestUser({ id: "u21", plan: "paid" });
      const site = await createTestSite({
        id: "s21",
        domain: "process2.com",
        ownerId: user.id,
      });
      await createTestBotVisit({
        siteId: site.id,
        botType: "ChatGPT",
        path: "/",
        count: 10,
        date: daysAgo(1),
      });

      mockGenerateBotInsight.mockResolvedValueOnce("Test bot insight content");

      const prepareSites = (await import("~/lib/prepareSites.server")).default;
      await prepareSites({ log: vi.fn<() => void>() });

      expect(mockGenerateBotInsight).toHaveBeenCalledWith(
        "process2.com",
        expect.arrayContaining([expect.objectContaining({ botType: "ChatGPT", total: 10 })]),
      );

      const insight = await prisma.botInsight.findUnique({
        where: { siteId: site.id },
      });
      expect(insight?.content).toBe("Test bot insight content");
    });

    it("should update lastProcessedAt after processing", async () => {
      const user = await createTestUser({ id: "u22", plan: "paid" });
      const site = await createTestSite({
        id: "s22",
        domain: "process3.com",
        ownerId: user.id,
      });

      const prepareSites = (await import("~/lib/prepareSites.server")).default;
      await prepareSites({ log: vi.fn<() => void>() });

      const updated = await prisma.site.findUnique({
        where: { id: site.id },
        select: { lastProcessedAt: true },
      });
      expect(updated?.lastProcessedAt).toBeTruthy();
    });

    it("should process multiple sites in parallel", async () => {
      const user = await createTestUser({ id: "u23", plan: "paid" });
      await createTestSite({
        id: "s23a",
        domain: "parallel1.com",
        ownerId: user.id,
      });
      await createTestSite({
        id: "s23b",
        domain: "parallel2.com",
        ownerId: user.id,
      });

      const prepareSites = (await import("~/lib/prepareSites.server")).default;
      const result = await prepareSites({ log: vi.fn<() => void>() });

      expect(result).toHaveLength(2);
      expect(mockUpsertCitingPages).toHaveBeenCalledTimes(2);
      expect(mockGenerateBotInsight).toHaveBeenCalledTimes(2);
    });

    it("should return sites with id, domain, digestSentAt", async () => {
      const user = await createTestUser({ id: "u24", plan: "paid" });
      await createTestSite({
        id: "s24",
        domain: "return.com",
        ownerId: user.id,
      });

      const prepareSites = (await import("~/lib/prepareSites.server")).default;
      const result = await prepareSites({ log: vi.fn<() => void>() });

      expect(result[0]).toHaveProperty("id");
      expect(result[0]).toHaveProperty("domain");
      expect(result[0]).toHaveProperty("digestSentAt");
    });
  });
});
