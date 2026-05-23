import { describe, expect, it } from "vitest";
import {
  processingIntervalHours,
  isProcessingEligible,
  isDigestEligible,
  TRIAL_DAYS,
} from "~/lib/userPlan.server";

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

describe("processingIntervalHours", () => {
  it("should return 168 for trial", () => {
    expect(processingIntervalHours("trial")).toBe(7 * 24);
  });
  it("should return 24 for paid", () => {
    expect(processingIntervalHours("paid")).toBe(24);
  });
  it("should return 24 for gratis", () => {
    expect(processingIntervalHours("gratis")).toBe(24);
  });
  it("should return Infinity for cancelled", () => {
    expect(processingIntervalHours("cancelled")).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("isProcessingEligible", () => {
  it("should return true for a paid user", () => {
    expect(isProcessingEligible({ plan: "paid", createdAt: daysAgo(30) })).toBe(
      true,
    );
  });
  it("should return true for a gratis user", () => {
    expect(
      isProcessingEligible({ plan: "gratis", createdAt: daysAgo(100) }),
    ).toBe(true);
  });
  it("should return false for a cancelled user", () => {
    expect(
      isProcessingEligible({ plan: "cancelled", createdAt: daysAgo(10) }),
    ).toBe(false);
  });
  it("should return true for a trial user within 25 days", () => {
    expect(
      isProcessingEligible({ plan: "trial", createdAt: daysAgo(10) }),
    ).toBe(true);
  });
  it("should return false for a trial user older than 25 days", () => {
    expect(
      isProcessingEligible({ plan: "trial", createdAt: daysAgo(26) }),
    ).toBe(false);
  });
  it("should return false for a trial user at exactly 25 days", () => {
    expect(
      isProcessingEligible({ plan: "trial", createdAt: daysAgo(25) }),
    ).toBe(false);
  });
});

describe("isDigestEligible", () => {
  it("should match isProcessingEligible for all tiers", () => {
    const cases: Parameters<typeof isProcessingEligible>[0][] = [
      { plan: "paid", createdAt: daysAgo(10) },
      { plan: "gratis", createdAt: daysAgo(10) },
      { plan: "cancelled", createdAt: daysAgo(10) },
      { plan: "trial", createdAt: daysAgo(5) },
      { plan: "trial", createdAt: daysAgo(26) },
    ];
    for (const c of cases) {
      expect(isDigestEligible(c)).toBe(isProcessingEligible(c));
    }
  });
});

describe("TRIAL_DAYS", () => {
  it("should be 25", () => {
    expect(TRIAL_DAYS).toBe(25);
  });
});
