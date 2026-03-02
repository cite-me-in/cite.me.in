import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import generateSiteQueries from "~/lib/llm-visibility/generateSiteQueries";

vi.mock("ai", () => ({ generateText: vi.fn(), Output: { array: vi.fn() } }));
vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: vi.fn().mockReturnValue("mock-model"),
}));
vi.mock("~/lib/envVars", () => ({
  default: { ANTHROPIC_API_KEY: "test-key" },
}));

const MOCK_QUERIES = [
  { group: "1.discovery", query: "How do I find short-term retail space?" },
  { group: "1.discovery", query: "Best platforms for pop-up shops?" },
  { group: "1.discovery", query: "Where to rent a temporary store?" },
  { group: "2.active_search", query: "Lease a kiosk in a mall for 3 months" },
  { group: "2.active_search", query: "Short-term retail lease options" },
  { group: "2.active_search", query: "Pop-up shop rental near me" },
  { group: "3.comparison", query: "Rentail vs Storefront alternatives" },
  { group: "3.comparison", query: "Best temporary retail platforms compared" },
  {
    group: "3.comparison",
    query: "Which pop-up rental site is most reliable?",
  },
];

describe("generateSiteQueries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("successfully generates queries", () => {
    let result: { group: string; query: string }[];

    beforeAll(async () => {
      const { generateText } = await import("ai");
      // biome-ignore lint/suspicious/noExplicitAny: test mock
      vi.mocked(generateText).mockResolvedValue({
        output: MOCK_QUERIES,
      } as any);
      result = await generateSiteQueries(
        "Rentail helps brands find pop-up retail space.",
      );
    });

    it("returns 9 queries across 3 groups", async () => {
      expect(result).toHaveLength(9);
    });

    it("returns 3 groups", async () => {
      const groups = [...new Set(result.map((q) => q.group))];
      expect(groups).toEqual([
        "1.discovery",
        "2.active_search",
        "3.comparison",
      ]);
    });

    it("returns 3 queries per group", async () => {
      const groups = [...new Set(result.map((q) => q.group))];
      expect(groups).toEqual([
        "1.discovery",
        "2.active_search",
        "3.comparison",
      ]);
    });

    it("returns queries that are specific to the site", async () => {
      const queries = result.map((q) => q.query);
      expect(queries).toEqual(MOCK_QUERIES.map((q) => q.query));
    });
  });

  it("propagates errors from generateText", async () => {
    const { generateText } = await import("ai");
    vi.mocked(generateText).mockRejectedValue(new Error("API error"));

    await expect(generateSiteQueries("some content")).rejects.toThrow(
      "API error",
    );
  });
});
