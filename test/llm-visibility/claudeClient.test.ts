import { generateText } from "ai";
import { describe, expect, it, vi } from "vitest";
import queryClaude from "~/lib/llm-visibility/claudeClient.server";


vi.mock("@ai-sdk/anthropic", () => {
  const anthropic = Object.assign(
    vi.fn(() => "mock-model"),
    { tools: { webSearch_20250305: vi.fn(() => "mock-web-search") } },
  );
  const createAnthropic = vi.fn(() => vi.fn(() => "mock-model"));
  return { anthropic, createAnthropic };
});

vi.mock("~/lib/llm-visibility/anthropic", () => ({
  haiku: "mock-haiku-model",
}));

vi.mock("ai", () => ({
  generateText: vi.fn(),
  gateway: vi.fn(),
}));

describe("queryClaude", () => {
  it("should return citations from URL sources and the response text", async () => {
    vi.mocked(generateText).mockResolvedValue({
      sources: [
        {
          type: "source",
          sourceType: "url",
          url: "https://example.com",
          providerMetadata: { anthropic: { citedText: "Cited text" } },
        },
        {
          type: "source",
          sourceType: "url",
          url: "https://other.com",
          providerMetadata: { anthropic: { citedText: "Cited text" } },
        },
      ],
      text: "Paris is the capital of France.",
    } as never);

    const result = await queryClaude({
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
        {
          type: "source",
          sourceType: "url",
          url: "https://example.com",
          providerMetadata: { anthropic: { citedText: "Cited text" } },
        },
        { type: "source", sourceType: "document", id: "doc-1" },
      ],
      text: "Response",
    } as never);

    const result = await queryClaude({
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

    const result = await queryClaude({
      maxRetries: 0,
      timeout: 0,
      query: "query",
    });

    expect(result.citations).toEqual([]);
  });
});
