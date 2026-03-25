import { generateText } from "ai";
import { describe, expect, it, vi } from "vitest";
import queryPerplexity from "~/lib/llm-visibility/perplexityClient";

vi.mock("~/lib/envVars", () => ({
  default: { PERPLEXITY_API_KEY: "test-key" },
}));

vi.mock("@ai-sdk/perplexity", () => ({
  createPerplexity: vi.fn(() => vi.fn(() => "mock-model")),
}));

vi.mock("ai", () => ({
  generateText: vi.fn(),
  gateway: vi.fn(),
}));

describe("queryPerplexity", () => {
  it("should return citations from URL sources and the response text", async () => {
    vi.mocked(generateText).mockResolvedValue({
      sources: [
        { type: "source", sourceType: "url", url: "https://example.com" },
        { type: "source", sourceType: "url", url: "https://other.com" },
      ],
      text: "Paris is the capital of France.",
    } as never);

    const result = await queryPerplexity({
      maxRetries: 0,
      timeout: 0,
      query: "What is the capital of France?",
    });

    expect(result.citations).toEqual([
      "https://example.com",
      "https://other.com",
    ]);
    expect(result.text).toBe("Paris is the capital of France.");
    expect(result.extraQueries).toEqual([]);
  });

  it("should filter out non-URL sources", async () => {
    vi.mocked(generateText).mockResolvedValue({
      sources: [
        { type: "source", sourceType: "url", url: "https://example.com" },
        { sourceType: "document", id: "doc-1" },
      ],
      text: "Response",
    } as never);

    const result = await queryPerplexity({
      maxRetries: 0,
      timeout: 0,
      query: "query",
    });

    expect(result.citations).toEqual(["https://example.com"]);
  });

  it("should return empty citations when there are no sources", async () => {
    vi.mocked(generateText).mockResolvedValue({
      sources: [],
      text: "I don't know.",
    } as never);

    const result = await queryPerplexity({
      maxRetries: 0,
      timeout: 0,
      query: "query",
    });

    expect(result.citations).toEqual([]);
  });
});
