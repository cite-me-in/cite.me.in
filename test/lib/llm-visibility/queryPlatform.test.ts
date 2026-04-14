import invariant from "tiny-invariant";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { isSameDomain } from "~/lib/isSameDomain";
import type { QueryFn } from "~/lib/llm-visibility/queryFn";
import { queryPlatform } from "~/lib/llm-visibility/queryPlatform";
import prisma from "~/lib/prisma.server";

vi.mock("@sentry/node", () => ({ captureException: vi.fn() }));

vi.mock("radashi", async (importOriginal) => {
  const original = await importOriginal<typeof import("radashi")>();
  return { ...original, sleep: vi.fn().mockResolvedValue(undefined) };
});

const CITATION_SETS = [
  {
    citations: ["https://rentail.space/listings", "https://other.com"],
    extraQueries: [],
    text: "You can find short-term retail space on rentail.space.",
    usage: { inputTokens: 100, outputTokens: 50 },
  },
  {
    citations: [
      "https://other.com",
      "https://example.com",
      "https://rentail.space/faq",
    ],
    extraQueries: [],
    text: "Platforms like rentail.space offer temporary retail options.",
    usage: { inputTokens: 120, outputTokens: 60 },
  },
  {
    citations: ["https://example.com", "https://unrelated.com"],
    extraQueries: [],
    text: "Shopping centers often have specialty leasing programs.",
    usage: { inputTokens: 80, outputTokens: 40 },
  },
];

const QUERIES = [
  {
    query: "How do I find short-term retail space in shopping malls?",
    group: "1. discovery",
  },
  {
    query: "Find available temporary retail space in shopping centers",
    group: "2. active_search",
  },
];

const PLATFORM_ARGS = {
  siteId: "site-1",
  model: "claude-haiku-4-5-20251001",
  platform: "claude",
  queries: QUERIES,
} as const;

describe("queryPlatform", () => {
  let site: { id: string; domain: string; summary: string; createdAt: Date };
  let queryFn: ReturnType<typeof vi.fn<QueryFn>>;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { id: "user-qp-1", email: "qp@test.com", passwordHash: "test" },
    });
    site = await prisma.site.create({
      data: {
        apiKey: "test-api-key-qp-1",
        content: "Test content",
        domain: "rentail.space",
        id: "site-1",
        ownerId: user.id,
        summary: "Test summary",
      },
    });
  });

  beforeAll(async () => {
    let callIndex = 0;
    queryFn = vi.fn<QueryFn>(async () => CITATION_SETS[callIndex++ % 3]);
    await queryPlatform({ ...PLATFORM_ARGS, site, queryFn });
  });

  it("should create a run and store citation queries for each query", {
    timeout: 30_000,
  }, async () => {

    const run = await prisma.citationQueryRun.findFirst({
      where: { siteId: site.id, platform: "claude" },
      include: {
        queries: {
          orderBy: [{ group: "asc" }, { query: "asc" }],
        },
      },
    });

    invariant(run, "run is not null");
    expect(run.model).toBe("claude-haiku-4-5-20251001");
    expect(run.queries).toHaveLength(2);
    expect(run.queries[0].citations).toHaveLength(2);
    expect(run.queries[1].citations).toHaveLength(3);
    expect(queryFn).toHaveBeenCalledTimes(2);

    // Ordered alphabetically: "Find..." before "How..."
    // "Find..." reps 1-3 map to citationSets 3,4,5 (indices 0,1,2)

    expect(run.queries[0].group).toBe("1. discovery");
    expect(run.queries[0].query).toBe(
      "How do I find short-term retail space in shopping malls?",
    );
    expect(
      run.queries[0].citations.findIndex((c) =>
        isSameDomain({ domain: site.domain, url: c }),
      ) + 1,
    );

    expect(run.queries[1].group).toBe("2. active_search");
    expect(run.queries[1].query).toBe(
      "Find available temporary retail space in shopping centers",
    );
    expect(
      run.queries[1].citations.findIndex((c) =>
        isSameDomain({ domain: site.domain, url: c }),
      ) + 1,
    ).toBe(3);
  });

  it("should create Citation records for each cited URL", {
    timeout: 30_000,
  }, async () => {
    const citations = await prisma.citation.findMany({
      where: { siteId: site.id },
      orderBy: { createdAt: "asc" },
    });

    // 2 queries: query[0] has 2 URLs, query[1] has 3 URLs = 5 total
    expect(citations.length).toBe(5);

    const domains = citations.map((c) => c.domain);
    expect(domains).toContain("rentail.space");
    expect(domains).toContain("other.com");
    expect(domains).toContain("example.com");

    for (const c of citations) {
      expect(c.queryId).toBeTruthy();
      expect(c.runId).toBeTruthy();
      expect(c.siteId).toBe(site.id);
    }
  });

  it("should persist CitationQuery shape correctly", {
    timeout: 30_000,
  }, async () => {
    const runs = await prisma.citationQueryRun.findMany({
      where: { siteId: site.id },
      include: {
        queries: { orderBy: [{ group: "asc" }, { query: "asc" }] },
      },
    });

    expect(runs).toHaveLength(1);

    const [run] = runs;
    expect(run.platform).toBe("claude");
    expect(run.model).toBe("claude-haiku-4-5-20251001");
    expect(run.siteId).toBe(site.id);
    expect(run.queries).toHaveLength(2);
    expect(run.queries[0].citations).toHaveLength(2);
    expect(run.queries[1].citations).toHaveLength(3);

    expect(run.queries[0]).toMatchObject({
      citations: ["https://rentail.space/listings", "https://other.com"],
      text: "You can find short-term retail space on rentail.space.",
      extraQueries: [],
    });

    expect(run.queries[1]).toMatchObject({
      query: "Find available temporary retail space in shopping centers",
      group: "2. active_search",
      citations: [
        "https://other.com",
        "https://example.com",
        "https://rentail.space/faq",
      ],
      text: "Platforms like rentail.space offer temporary retail options.",
      extraQueries: [],
    });
  });
});
