import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchOrganicResults } from "~/lib/serp/serpApi.server";
import { server } from "~/test/mocks/msw";

vi.mock("~/lib/envVars.server", () => ({
  default: { SERPAPI_API_KEY: "test-key" },
}));

afterEach(() => server.resetHandlers());

describe.each(["google", "bing"] as const)(
  "fetchOrganicResults (%s)",
  (engine) => {
    it("should return organic URLs from the first page", async () => {
      server.use(
        http.get("https://serpapi.com/search", () =>
          HttpResponse.json({
            organic_results: [
              { link: "https://example.com/page", title: "Example" },
              { link: "https://other.com/article", title: "Other" },
              { link: "https://third.com/", title: "Third" },
            ],
          }),
        ),
      );

      const result = await fetchOrganicResults("best retail space platforms", engine);

      expect(result).toEqual([
        "https://example.com/page",
        "https://other.com/article",
        "https://third.com/",
      ]);
    });

    it("should return empty array when no organic results", async () => {
      server.use(
        http.get("https://serpapi.com/search", () =>
          HttpResponse.json({ organic_results: [] }),
        ),
      );

      const result = await fetchOrganicResults("very niche query", engine);

      expect(result).toEqual([]);
    });

    it("should pass the correct engine param in the request", async () => {
      let capturedUrl: URL | null = null;
      server.use(
        http.get("https://serpapi.com/search", ({ request }) => {
          capturedUrl = new URL(request.url);
          return HttpResponse.json({ organic_results: [] });
        }),
      );

      await fetchOrganicResults("test query", engine);

      expect(capturedUrl!.searchParams.get("engine")).toBe(engine);
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
        fetchOrganicResults("query", engine),
      ).rejects.toThrow("SerpApi error 401");
    });
  },
);
