import { afterEach, describe, expect, it, vi } from "vitest";
import { server } from "~/test/mocks/msw";

let mockFetch: ReturnType<typeof vi.fn>;

afterEach(() => {
  mockFetch.mockRestore();
  server.listen({ onUnhandledRequest: "warn" });
});

describe.each([
  "google",
  "bing",
] as const)("fetchOrganicResults (%s)", (engine) => {
  it("should return organic URLs from the first page", async () => {
    mockFetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          organic_results: [
            { link: "https://example.com/page", title: "Example" },
            { link: "https://other.com/article", title: "Other" },
            { link: "https://third.com/", title: "Third" },
          ],
        }),
        { status: 200 },
      ),
    );
    server.close();
    vi.stubGlobal("fetch", mockFetch);

    const { default: fetchSERPResults } = await import(
      "~/lib/llm-visibility/serpApi.server"
    );

    const result = await fetchSERPResults({
      query: "best retail space platforms",
      engine,
      timeout: 0,
    });

    expect(result.citations).toEqual([
      "https://example.com/page",
      "https://other.com/article",
      "https://third.com/",
    ]);
  });

  it("should return empty array when no organic results", async () => {
    mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ organic_results: [] }), { status: 200 }),
      );
    server.close();
    vi.stubGlobal("fetch", mockFetch);

    const { default: fetchSERPResults } = await import(
      "~/lib/llm-visibility/serpApi.server"
    );

    const result = await fetchSERPResults({
      query: "very niche query",
      engine,
      timeout: 0,
    });

    expect(result).toEqual({
      citations: [],
      extraQueries: [],
      text: "",
      usage: {
        inputTokens: 0,
        outputTokens: 0,
      },
    });
  });

  it("should pass the correct params in the request", async () => {
    mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ organic_results: [] }), { status: 200 }),
      );
    server.close();
    vi.stubGlobal("fetch", mockFetch);

    const { default: fetchSERPResults } = await import(
      "~/lib/llm-visibility/serpApi.server"
    );

    await fetchSERPResults({ query: "test query", engine, timeout: 0 });

    const calledUrl = new URL(mockFetch.mock.calls[0][0] as string);
    expect(calledUrl.searchParams.get("engine")).toBe(engine);
    expect(calledUrl.searchParams.get("q")).toBe("test query");
  });

  it("should throw when the API response is not ok", async () => {
    mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
        }),
      );
    server.close();
    vi.stubGlobal("fetch", mockFetch);

    const { default: fetchSERPResults } = await import(
      "~/lib/llm-visibility/serpApi.server"
    );

    await expect(
      fetchSERPResults({ query: "query", engine, timeout: 0 }),
    ).rejects.toThrow("SerpApi error 401");
  });
});
