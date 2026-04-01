import { afterEach, describe, expect, it, vi } from "vitest";
import fetchAioResults from "~/lib/serp/serpApi.server";

vi.mock("~/lib/envVars.server", () => ({
  default: { SERPAPI_API_KEY: "test-key" },
}));

const makeResponse = (body: unknown) =>
  ({
    ok: true,
    json: async () => body,
  }) as Response;

describe("fetchAioResults", () => {
  afterEach(() => vi.restoreAllMocks());

  it("should return aioPresent=true and citations when AIO block exists", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      makeResponse({
        ai_overview: {
          references: [
            { link: "https://example.com/page", title: "Example" },
            { link: "https://other.com/", title: "Other" },
          ],
        },
        organic_results: [{ link: "https://example.com" }],
      }),
    );

    const result = await fetchAioResults("best retail space platforms");

    expect(result).toEqual({
      aioPresent: true,
      citations: ["https://example.com/page", "https://other.com/"],
    });
  });

  it("should return aioPresent=false and empty citations when no AIO block", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      makeResponse({
        organic_results: [{ link: "https://example.com" }],
      }),
    );

    const result = await fetchAioResults("niche query with no AIO");

    expect(result).toEqual({ aioPresent: false, citations: [] });
  });

  it("should return aioPresent=true and empty citations when AIO has no references", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      makeResponse({ ai_overview: { references: [] } }),
    );

    const result = await fetchAioResults("query");

    expect(result).toEqual({ aioPresent: true, citations: [] });
  });

  it("should throw when the API response is not ok", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    } as Response);

    await expect(fetchAioResults("query")).rejects.toThrow("SerpApi error 401");
  });

  it("should include api_key and engine=google in the request URL", async () => {
    const spy = vi.spyOn(global, "fetch").mockResolvedValue(
      makeResponse({}),
    );

    await fetchAioResults("test query");

    const calledUrl = new URL(spy.mock.calls[0][0] as string);
    expect(calledUrl.searchParams.get("engine")).toBe("google");
    expect(calledUrl.searchParams.get("api_key")).toBe("test-key");
    expect(calledUrl.searchParams.get("q")).toBe("test query");
  });
});
