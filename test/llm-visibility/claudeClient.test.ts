import { generateText } from "ai";
import { describe, expect, it, vi } from "vitest";
import queryClaude from "~/lib/llm-visibility/claudeClient";

vi.mock("~/lib/envVars", () => ({
  default: { ANTHROPIC_API_KEY: "test-key" },
}));

vi.mock("@ai-sdk/anthropic", () => {
  const anthropic = Object.assign(
    vi.fn(() => "mock-model"),
    {
      tools: { webSearch_20250305: vi.fn(() => "mock-web-search") },
    },
  );
  return { anthropic };
});

vi.mock("~/lib/llm-visibility/anthropic", () => ({
  haiku: "mock-haiku-model",
}));

vi.mock("ai", () => ({
  generateText: vi.fn(),
}));

describe("queryClaude", () => {
  it("returns citations from URL sources and the response text", async () => {
    vi.mocked(generateText).mockResolvedValue({
      sources: [
        { sourceType: "url", url: "https://example.com" },
        { sourceType: "url", url: "https://other.com" },
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

  it("filters out non-URL sources", async () => {
    vi.mocked(generateText).mockResolvedValue({
      sources: [
        { sourceType: "url", url: "https://example.com" },
        { sourceType: "document", id: "doc-1" },
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

  it("returns empty citations when there are no sources", async () => {
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
