import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock("@perplexity-ai/perplexity_ai", async (importOriginal) => {
  const { APIError: PerplexityAPIError } =
    await importOriginal<typeof import("@perplexity-ai/perplexity_ai")>();
  return {
    default: class {
      static APIError = PerplexityAPIError;
      search = {
        create: mockCreate,
      };
    },
    APIError: PerplexityAPIError,
  };
});

vi.mock("~/lib/envVars.server", () => ({
  default: { PERPLEXITY_API_KEY: "test-key" },
}));

describe("queryPerplexity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return citations from search results and formatted text", async () => {
    mockCreate.mockResolvedValue({
      id: "search_abc123",
      server_time: 1678886400,
      results: [
        {
          title: "Paris - Wikipedia",
          url: "https://example.com/paris",
          snippet: "Paris is the capital of France.",
          date: "2024-01-15",
          last_updated: "2024-01-16",
        },
        {
          title: "France Capital",
          url: "https://other.com/france",
          snippet: "The capital city of France is Paris.",
          date: "2024-01-10",
          last_updated: "2024-01-11",
        },
      ],
    });

    const { default: queryPerplexity } =
      await import("~/lib/llm-visibility/perplexityClient.server");

    const result = await queryPerplexity({
      maxRetries: 0,
      timeout: 0,
      query: "What is the capital of France?",
    });

    expect(result.citations).toEqual([
      "https://example.com/paris",
      "https://other.com/france",
    ]);
    expect(result.text).toContain("Paris - Wikipedia");
    expect(result.text).toContain("Paris is the capital of France.");
    expect(result.extraQueries).toEqual([]);
  });

  it("should return empty citations when no results", async () => {
    mockCreate.mockResolvedValue({
      id: "search_abc123",
      server_time: 1678886400,
      results: [],
    });

    const { default: queryPerplexity } =
      await import("~/lib/llm-visibility/perplexityClient.server");

    const result = await queryPerplexity({
      maxRetries: 0,
      timeout: 0,
      query: "query",
    });

    expect(result.citations).toEqual([]);
    expect(result.text).toBe("");
  });

  it("should filter out results with empty URLs", async () => {
    mockCreate.mockResolvedValue({
      id: "search_abc123",
      server_time: 1678886400,
      results: [
        {
          title: "Valid Result",
          url: "https://example.com",
          snippet: "Valid snippet",
          date: "2024-01-15",
          last_updated: "2024-01-16",
        },
        {
          title: "No URL",
          url: "",
          snippet: "No URL snippet",
          date: "2024-01-15",
          last_updated: "2024-01-16",
        },
      ],
    });

    const { default: queryPerplexity } =
      await import("~/lib/llm-visibility/perplexityClient.server");

    const result = await queryPerplexity({
      maxRetries: 0,
      timeout: 0,
      query: "query",
    });

    expect(result.citations).toEqual(["https://example.com"]);
  });

  it("should throw InsufficientCreditError on 429 response", async () => {
    const { APIError: PerplexityAPIError } =
      await import("@perplexity-ai/perplexity_ai");
    mockCreate.mockRejectedValue(
      new PerplexityAPIError(429, {}, "Rate limit exceeded", new Headers()),
    );

    const { default: queryPerplexity } =
      await import("~/lib/llm-visibility/perplexityClient.server");

    const { isInsufficientCreditError } =
      await import("~/lib/llm-visibility/insufficientCreditError");
    try {
      await queryPerplexity({ maxRetries: 0, timeout: 0, query: "query" });
      expect.unreachable("Should have thrown");
    } catch (error) {
      expect(isInsufficientCreditError(error)).toBe(true);
      expect(error).toMatchObject({ platform: "perplexity", statusCode: 429 });
    }
  });

  it("should not throw InsufficientCreditError on other errors", async () => {
    const { APIError: PerplexityAPIError } =
      await import("@perplexity-ai/perplexity_ai");
    mockCreate.mockRejectedValue(
      new PerplexityAPIError(500, {}, "Internal Server Error", new Headers()),
    );

    const { default: queryPerplexity } =
      await import("~/lib/llm-visibility/perplexityClient.server");

    const { isInsufficientCreditError } =
      await import("~/lib/llm-visibility/insufficientCreditError");
    try {
      await queryPerplexity({ maxRetries: 0, timeout: 0, query: "query" });
      expect.unreachable("Should have thrown");
    } catch (error) {
      expect(isInsufficientCreditError(error)).toBe(false);
    }
  });
});
