import { beforeEach, describe, expect, it } from "vite-plus/test";
import prisma from "~/lib/prisma.server";
import {
  checkUsageLimits,
  recordUsageEvent,
} from "~/lib/usage/usageLimit.server";
import UsageLimitExceededError from "~/lib/usage/UsageLimitExceededError";

const SITE_ID = "test-usage-site-1";

beforeEach(async () => {
  await prisma.usageEvent.deleteMany({ where: { siteId: SITE_ID } });
  await prisma.site.upsert({
    where: { id: SITE_ID },
    create: {
      apiKey: "cite.me.in_21945ffb0342eb204b60aaf28c7bdca9",
      content: "Test content",
      domain: "test-usage.example.com",
      id: SITE_ID,
      summary: "Test summary",
      owner: {
        create: {
          id: "test-usage-user-1",
          email: "usage@test.com",
          passwordHash: "test",
        },
      },
    },
    update: {},
  });
});

describe("recordUsageEvent", () => {
  it("should insert a UsageEvent row with computed cost", async () => {
    await recordUsageEvent({
      siteId: SITE_ID,
      model: "claude-haiku-4-5-20251001",
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });

    const events = await prisma.usageEvent.findMany({
      where: { siteId: SITE_ID },
    });
    expect(events).toHaveLength(1);
    // $1.00 input + $5.00 output = $6.00
    expect(Number(events[0].cost)).toBeCloseTo(6.0);
    expect(events[0].inputTokens).toBe(1_000_000);
    expect(events[0].outputTokens).toBe(1_000_000);
  });
});

describe("checkUsageLimits", () => {
  it("should pass when no events exist", async () => {
    await expect(checkUsageLimits(SITE_ID)).resolves.toBeUndefined();
  });

  it("should throw UsageLimitExceededError when hourly cost is exceeded", async () => {
    // Insert enough events to exceed $2.00/hour limit
    // claude-haiku: $1/M input + $5/M output; 500k output = $2.50 > $2 limit
    await recordUsageEvent({
      siteId: SITE_ID,
      model: "claude-haiku-4-5-20251001",
      inputTokens: 0,
      outputTokens: 500_000,
    });

    await expect(checkUsageLimits(SITE_ID)).rejects.toThrow(
      UsageLimitExceededError,
    );
  });

  it("should throw with correct window and limitType", async () => {
    await recordUsageEvent({
      siteId: SITE_ID,
      model: "claude-haiku-4-5-20251001",
      inputTokens: 0,
      outputTokens: 500_000,
    });

    try {
      await checkUsageLimits(SITE_ID);
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(UsageLimitExceededError);
      const e = error as UsageLimitExceededError;
      expect(e.timeWindow).toBe("hourly");
      expect(Number(e.current)).toBeGreaterThan(2.0);
      expect(Number(e.limit)).toBe(2.0);
    }
  });
});
