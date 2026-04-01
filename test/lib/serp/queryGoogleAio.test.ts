import { beforeAll, describe, expect, it, vi } from "vitest";
import fetchAioResults from "~/lib/serp/dataForSeo.server";
import queryGoogleAio from "~/lib/serp/queryGoogleAio.server";
import prisma from "~/lib/prisma.server";

vi.mock("@sentry/node", () => ({ captureException: vi.fn() }));
vi.mock("~/lib/serp/dataForSeo.server");
vi.mock("~/lib/envVars.server", () => ({
  default: {
    DATAFORSEO_LOGIN: "test@example.com",
    DATAFORSEO_PASSWORD: "test-password",
  },
}));

const QUERIES = [
  { query: "best temporary retail space platform", group: "1. discovery" },
  { query: "short-term retail lease options", group: "2. active_search" },
];

describe("queryGoogleAio", () => {
  let site: { id: string; domain: string };

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { id: "user-aio-1", email: "aio@test.com", passwordHash: "test" },
    });
    site = await prisma.site.create({
      data: {
        apiKey: "test-api-key-aio-1",
        content: "Test content",
        domain: "rentail.space",
        id: "site-aio-1",
        ownerId: user.id,
        summary: "Test summary",
      },
    });
    for (const q of QUERIES) {
      await prisma.siteQuery.create({
        data: { siteId: site.id, query: q.query, group: q.group },
      });
    }
  });

  it("should create a SerpRun and SerpQuery rows for each query", async () => {
    vi.mocked(fetchAioResults)
      .mockResolvedValueOnce({
        aioPresent: true,
        citations: ["https://rentail.space/listings", "https://other.com"],
      })
      .mockResolvedValueOnce({
        aioPresent: false,
        citations: [],
      });

    await queryGoogleAio(site);

    const run = await prisma.serpRun.findFirst({
      where: { siteId: site.id, source: "google-aio" },
      include: { queries: { orderBy: { query: "asc" } } },
    });

    expect(run).not.toBeNull();
    expect(run!.queries).toHaveLength(2);

    const q1 = run!.queries.find((q) => q.query === "best temporary retail space platform");
    const q2 = run!.queries.find((q) => q.query === "short-term retail lease options");

    expect(q1).toBeDefined();
    expect(q1!.group).toBe("1. discovery");
    expect(q1!.aioPresent).toBe(true);
    expect(q1!.citations).toEqual(["https://rentail.space/listings", "https://other.com"]);

    expect(q2).toBeDefined();
    expect(q2!.group).toBe("2. active_search");
    expect(q2!.aioPresent).toBe(false);
    expect(q2!.citations).toEqual([]);
  });

  it("should not create duplicate SerpQuery rows when run twice on the same day", async () => {
    vi.mocked(fetchAioResults).mockResolvedValue({
      aioPresent: true,
      citations: ["https://rentail.space"],
    });

    await queryGoogleAio(site);

    const runs = await prisma.serpRun.findMany({
      where: { siteId: site.id, source: "google-aio" },
      include: { queries: true },
    });

    expect(runs).toHaveLength(1);
    expect(runs[0].queries).toHaveLength(2);
  });
});
