import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "~/lib/prisma.server";
import type { Site } from "~/prisma";

const mockCreate = vi.hoisted(() =>
  vi.fn<
    () => Promise<{
      content: { type: string; text: string }[];
    }>
  >(),
);

vi.mock("@anthropic-ai/sdk", () => ({
  Anthropic: class {
    beta = {
      messages: {
        create: mockCreate,
      },
    };
  },
}));

const MOCK_QUERIES = [
  { group: "1. discovery", query: "How do I find short-term retail space?" },
  { group: "1. discovery", query: "Best platforms for pop-up shops?" },
  { group: "1. discovery", query: "Where to rent a temporary store?" },
  { group: "2. active_search", query: "Lease a kiosk in a mall for 3 months" },
  { group: "2. active_search", query: "Short-term retail lease options" },
  { group: "2. active_search", query: "Pop-up shop rental near me" },
  { group: "3. comparison", query: "Rentail vs Storefront alternatives" },
  { group: "3. comparison", query: "Best temporary retail platforms compared" },
  {
    group: "3. comparison",
    query: "Which pop-up rental site is most reliable?",
  },
];

describe("generateSiteQueries", () => {
  let site: Site;

  beforeEach(async () => {
    vi.clearAllMocks();
    await prisma.user.deleteMany();
    const user = await prisma.user.create({
      data: { id: "user-gsq-1", email: "gsq@test.com", passwordHash: "test" },
    });
    site = await prisma.site.create({
      data: {
        apiKey: "test-api-key-gsq-1",
        content: "Test content",
        domain: "rentail.space",
        id: "site-1",
        ownerId: user.id,
        summary: "Test summary",
      },
    });
  });

  it("should return 9 queries across 3 groups", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(MOCK_QUERIES) }],
    });

    const { default: generateSiteQueries } =
      await import("~/lib/llm-visibility/generateSiteQueries");

    const suggestions = await generateSiteQueries(site.id);
    expect(suggestions).toHaveLength(9);
    expect(suggestions.map((q) => ({ group: q.group, query: q.query }))).toEqual(MOCK_QUERIES);
  });

  it("should propagate errors from API", async () => {
    mockCreate.mockRejectedValue(new Error("API error"));

    const { default: generateSiteQueries } =
      await import("~/lib/llm-visibility/generateSiteQueries");

    await expect(generateSiteQueries(site.id)).rejects.toThrow("API error");
  });
});
