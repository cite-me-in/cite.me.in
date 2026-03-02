import { beforeEach, describe, expect, it, vi } from "vitest";
import generateSiteQueries from "~/lib/llm-visibility/generateSiteQueries";

vi.mock("ai", () => ({ generateObject: vi.fn() }));
vi.mock("@ai-sdk/anthropic", () => ({ anthropic: vi.fn().mockReturnValue("mock-model") }));

const MOCK_QUERIES = [
  { group: "1.discovery", query: "How do I find short-term retail space?" },
  { group: "1.discovery", query: "Best platforms for pop-up shops?" },
  { group: "1.discovery", query: "Where to rent a temporary store?" },
  { group: "2.active_search", query: "Lease a kiosk in a mall for 3 months" },
  { group: "2.active_search", query: "Short-term retail lease options" },
  { group: "2.active_search", query: "Pop-up shop rental near me" },
  { group: "3.comparison", query: "Rentail vs Storefront alternatives" },
  { group: "3.comparison", query: "Best temporary retail platforms compared" },
  { group: "3.comparison", query: "Which pop-up rental site is most reliable?" },
];

describe("generateSiteQueries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 9 queries across 3 groups", async () => {
    const { generateObject } = await import("ai");
    vi.mocked(generateObject).mockResolvedValue({ object: { queries: MOCK_QUERIES } } as any);

    const result = await generateSiteQueries("Rentail helps brands find pop-up retail space.");
    expect(result).toHaveLength(9);
    const groups = [...new Set(result.map((q) => q.group))];
    expect(groups).toEqual(["1.discovery", "2.active_search", "3.comparison"]);
  });

  it("propagates errors from generateObject", async () => {
    const { generateObject } = await import("ai");
    vi.mocked(generateObject).mockRejectedValue(new Error("API error"));

    await expect(generateSiteQueries("some content")).rejects.toThrow("API error");
  });
});
