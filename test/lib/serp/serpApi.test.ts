import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import fetchAioResults from "~/lib/serp/serpApi.server";
import { server } from "~/test/mocks/msw";

vi.mock("~/lib/envVars.server", () => ({
  default: { SERPAPI_API_KEY: "test-key" },
}));

afterEach(() => server.resetHandlers());

describe("fetchAioResults", () => {
  it("should return aioPresent=true and citations when AIO block exists", async () => {
    server.use(
      http.get("https://serpapi.com/search", () =>
        HttpResponse.json({
          ai_overview: {
            references: [
              { link: "https://example.com/page", title: "Example" },
              { link: "https://other.com/", title: "Other" },
            ],
          },
        }),
      ),
    );

    const result = await fetchAioResults("best retail space platforms");

    expect(result).toEqual({
      aioPresent: true,
      citations: ["https://example.com/page", "https://other.com/"],
    });
  });

  it("should return aioPresent=false and empty citations when no AIO block", async () => {
    server.use(
      http.get("https://serpapi.com/search", () =>
        HttpResponse.json({ organic_results: [] }),
      ),
    );

    const result = await fetchAioResults("niche query with no AIO");

    expect(result).toEqual({ aioPresent: false, citations: [] });
  });

  it("should return aioPresent=true and empty citations when AIO has no references", async () => {
    server.use(
      http.get("https://serpapi.com/search", () =>
        HttpResponse.json({ ai_overview: { references: [] } }),
      ),
    );

    const result = await fetchAioResults("query");

    expect(result).toEqual({ aioPresent: true, citations: [] });
  });

  it("should throw when the API response is not ok", async () => {
    server.use(
      http.get("https://serpapi.com/search", () =>
        HttpResponse.json({ error: "Unauthorized" }, { status: 401 }),
      ),
    );

    await expect(fetchAioResults("query")).rejects.toThrow("SerpApi error 401");
  });

  it("should include api_key and engine=google in the request URL", async () => {
    let capturedUrl: URL | null = null;
    server.use(
      http.get("https://serpapi.com/search", ({ request }) => {
        capturedUrl = new URL(request.url);
        return HttpResponse.json({});
      }),
    );

    await fetchAioResults("test query");

    expect(capturedUrl!.searchParams.get("engine")).toBe("google");
    expect(capturedUrl!.searchParams.get("api_key")).toBe("test-key");
    expect(capturedUrl!.searchParams.get("q")).toBe("test query");
  });
});
