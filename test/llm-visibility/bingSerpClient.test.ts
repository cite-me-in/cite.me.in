import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchOrganicResults } from "~/lib/serp/serpApi.server";
import { server } from "~/test/mocks/msw";

vi.mock("~/lib/envVars.server", () => ({
  default: { SERPAPI_API_KEY: "test-key" },
}));

afterEach(() => server.resetHandlers());

describe("fetchOrganicResults (bing)", () => {
  it("should return organic URLs from the first page", async () => {
    server.use(
      http.get("https://serpapi.com/search", () =>
        HttpResponse.json({
          organic_results: [
            { link: "https://example.com/page", title: "Example" },
            { link: "https://other.com/article", title: "Other" },
          ],
        }),
      ),
    );

    const result = await fetchOrganicResults("best retail space platforms", "bing");

    expect(result).toEqual([
      "https://example.com/page",
      "https://other.com/article",
    ]);
  });

  it("should return empty array when no organic results", async () => {
    server.use(
      http.get("https://serpapi.com/search", () =>
        HttpResponse.json({ organic_results: [] }),
      ),
    );

    const result = await fetchOrganicResults("very niche query", "bing");

    expect(result).toEqual([]);
  });

  it("should use engine=bing in the request", async () => {
    let capturedUrl: URL | null = null;
    server.use(
      http.get("https://serpapi.com/search", ({ request }) => {
        capturedUrl = new URL(request.url);
        return HttpResponse.json({ organic_results: [] });
      }),
    );

    await fetchOrganicResults("test query", "bing");

    expect(capturedUrl!.searchParams.get("engine")).toBe("bing");
    expect(capturedUrl!.searchParams.get("q")).toBe("test query");
    expect(capturedUrl!.searchParams.get("api_key")).toBe("test-key");
  });

  it("should throw when the API response is not ok", async () => {
    server.use(
      http.get("https://serpapi.com/search", () =>
        HttpResponse.json({ error: "Unauthorized" }, { status: 401 }),
      ),
    );

    await expect(
      fetchOrganicResults("query", "bing"),
    ).rejects.toThrow("SerpApi error 401");
  });
});
