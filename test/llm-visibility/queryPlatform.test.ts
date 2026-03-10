import { Temporal } from "@js-temporal/polyfill";
import { invariant } from "es-toolkit";
import { beforeAll, describe, expect, it, vi } from "vitest";
import queryPlatform from "~/lib/llm-visibility/queryPlatform";
import prisma from "~/lib/prisma.server";

vi.mock("@sentry/node", () => ({ captureException: vi.fn() }));

vi.mock("es-toolkit", async (importOriginal) => {
  const original = await importOriginal<typeof import("es-toolkit")>();
  return { ...original, delay: vi.fn().mockResolvedValue(undefined) };
});

// Citations cycle across repetitions — rentail.space appears at varying positions
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
  accountId: "account-1",
  modelId: "claude-haiku-4-5-20251001",
  platform: "claude",
  queries: QUERIES,
  repetitions: 3,
} as const;

function newerThan24h() {
  return Temporal.Now.instant()
    .subtract({ hours: 24 })
    .toZonedDateTimeISO("UTC")
    .toPlainDateTime();
}

describe("queryPlatform", () => {
  let site: { id: string; domain: string; createdAt: Date };

  beforeAll(async () => {
    site = await prisma.site.create({
      data: {
        id: "site-1",
        domain: "rentail.space",
        account: { create: { id: "account-1" } },
      },
    });
  });

  it(
    "creates a run and stores citation queries for each query x repetition",
    { timeout: 30_000 },
    async () => {
      let callIndex = 0;
      const queryFn = vi.fn(async () => CITATION_SETS[callIndex++ % 3]);

      await queryPlatform({
        ...PLATFORM_ARGS,
        site,
        newerThan: newerThan24h(),
        queryFn,
      });

      const run = await prisma.citationQueryRun.findFirst({
        where: { siteId: site.id, platform: "claude" },
        include: {
          queries: { orderBy: [{ query: "asc" }] },
        },
      });

      invariant(run, "run is not null");
      expect(run.model).toBe("claude-haiku-4-5-20251001");
      expect(run.queries).toHaveLength(6); // 2 queries × 3 repetitions
      expect(queryFn).toHaveBeenCalledTimes(6);

      // Ordered alphabetically: "Find..." before "How..."
      // "Find..." reps 1-3 map to citationSets 3,4,5 (indices 0,1,2)
      const [find1, find2, find3, how1, how2, how3] = run.queries;

      expect(find1.group).toBe("2. active_search");
      expect(find1.position).toBe(0); // rentail.space at index 0
      expect(find2.position).toBe(2); // rentail.space at index 2
      expect(find3.position).toBeNull(); // not present

      expect(how1.group).toBe("1. discovery");
      expect(how1.position).toBe(0);
      expect(how2.position).toBe(2);
      expect(how3.position).toBeNull();
    },
  );

  it(
    "skips creating a new run if one already exists within newerThan",
    { timeout: 30_000 },
    async () => {
      const queryFn = vi.fn();

      await queryPlatform({
        ...PLATFORM_ARGS,
        site,
        newerThan: newerThan24h(),
        queryFn,
      });

      expect(queryFn).not.toHaveBeenCalled();
    },
  );

  it(
    "final db state: exactly 1 run with 6 citation_queries with correct fields",
    { timeout: 30_000 },
    async () => {
      const runs = await prisma.citationQueryRun.findMany({
        where: { siteId: site.id },
        include: {
          queries: { orderBy: [{ query: "asc" }] },
        },
      });

      expect(runs).toHaveLength(1);

      const [run] = runs;
      expect(run.platform).toBe("claude");
      expect(run.model).toBe("claude-haiku-4-5-20251001");
      expect(run.siteId).toBe(site.id);
      expect(run.queries).toHaveLength(6);

      // Ordered by query ASC, repetition ASC: "Find..." before "How..."
      const [find1, find2, find3, how1, how2, how3] = run.queries;

      expect(find1).toMatchObject({
        query: "Find available temporary retail space in shopping centers",
        group: "2. active_search",
        repetition: 1,
        citations: ["https://rentail.space/listings", "https://other.com"],
        text: "You can find short-term retail space on rentail.space.",
        position: 0,
        extraQueries: [],
      });
      expect(find2).toMatchObject({
        repetition: 2,
        citations: [
          "https://other.com",
          "https://example.com",
          "https://rentail.space/faq",
        ],
        text: "Platforms like rentail.space offer temporary retail options.",
        position: 2,
        extraQueries: [],
      });
      expect(find3).toMatchObject({
        repetition: 3,
        citations: ["https://example.com", "https://unrelated.com"],
        text: "Shopping centers often have specialty leasing programs.",
        position: null,
        extraQueries: [],
      });

      expect(how1).toMatchObject({
        query: "How do I find short-term retail space in shopping malls?",
        group: "1. discovery",
        repetition: 1,
        citations: ["https://rentail.space/listings", "https://other.com"],
        text: "You can find short-term retail space on rentail.space.",
        position: 0,
        extraQueries: [],
      });
      expect(how2).toMatchObject({
        repetition: 2,
        citations: [
          "https://other.com",
          "https://example.com",
          "https://rentail.space/faq",
        ],
        text: "Platforms like rentail.space offer temporary retail options.",
        position: 2,
        extraQueries: [],
      });
      expect(how3).toMatchObject({
        repetition: 3,
        citations: ["https://example.com", "https://unrelated.com"],
        text: "Shopping centers often have specialty leasing programs.",
        position: null,
        extraQueries: [],
      });
    },
  );
});
