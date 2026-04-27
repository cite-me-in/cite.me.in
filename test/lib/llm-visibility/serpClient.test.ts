import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it } from "vite-plus/test";
import fetchSERPResults from "~/lib/llm-visibility/serpApi.server";
import msw from "~/test/mocks/msw";

afterEach(() => msw.resetHandlers());

describe.each(["google", "bing"] as const)(
  "fetchOrganicResults (%s)",
  (engine) => {
    it("should return organic URLs from the first page", async () => {
      msw.use(
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
      msw.use(
        http.get("https://serpapi.com/search", () =>
          HttpResponse.json({ organic_results: [] }),
        ),
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
      let capturedUrl: URL | undefined;
      msw.use(
        http.get("https://serpapi.com/search", ({ request }) => {
          capturedUrl = new URL(request.url);
          return HttpResponse.json({ organic_results: [] });
        }),
      );

      await fetchSERPResults({ query: "test query", engine, timeout: 0 });

      expect(capturedUrl?.searchParams.get("engine")).toBe(engine);
      expect(capturedUrl?.searchParams.get("q")).toBe("test query");
    });

    it("should throw InsufficientCreditError on 429 response", async () => {
      msw.use(
        http.get("https://serpapi.com/search", () =>
          HttpResponse.json({ error: "Rate limited" }, { status: 429 }),
        ),
      );

      const { isInsufficientCreditError } =
        await import("~/lib/llm-visibility/insufficientCreditError");
      try {
        await fetchSERPResults({
          query: "query",
          engine,
          timeout: 5000,
        });
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(isInsufficientCreditError(error)).toBe(true);
      }
    });

    it("should throw InsufficientCreditError on 402 response for copilot", async () => {
      msw.use(
        http.get("https://serpapi.com/search", () =>
          HttpResponse.json({ error: "Payment required" }, { status: 402 }),
        ),
      );

      const { isInsufficientCreditError } =
        await import("~/lib/llm-visibility/insufficientCreditError");
      try {
        await fetchSERPResults({
          query: "query",
          engine: "bing_copilot",
          timeout: 5000,
        });
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(isInsufficientCreditError(error)).toBe(true);
        expect(error).toMatchObject({ platform: "copilot" });
      }
    });

    it("should throw when the API response is not ok", async () => {
      msw.use(
        http.get("https://serpapi.com/search", () =>
          HttpResponse.json({ error: "Unauthorized" }, { status: 401 }),
        ),
      );

      await expect(
        fetchSERPResults({ query: "query", engine, timeout: 0 }),
      ).rejects.toThrow("SerpApi error 401");
    });
  },
);
