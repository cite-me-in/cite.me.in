import { generateText } from "ai";
import { describe, expect, it, vi } from "vitest";
import openaiClient from "~/lib/llm-visibility/openaiClient";

vi.mock("@ai-sdk/openai", () => {
  const openai = Object.assign(
    vi.fn(() => "mock-model"),
    {
      tools: { webSearch: vi.fn(() => "mock-web-search") },
    },
  );
  return { openai };
});

vi.mock("ai", () => ({
  generateText: vi.fn(),
  gateway: vi.fn(),
}));

describe("openaiClient", () => {
  it("should return citations from URL sources and the response text", async () => {
    vi.mocked(generateText).mockResolvedValue({
      sources: [
        { type: "source", sourceType: "url", url: "https://example.com" },
        { type: "source", sourceType: "url", url: "https://other.com" },
      ],
      text: "Paris is the capital of France.",
    } as never);

    const result = await openaiClient({
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

    const result = await openaiClient({
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

    const result = await openaiClient({
      maxRetries: 0,
      timeout: 0,
      query: "query",
    });

    expect(result.citations).toEqual([]);
  });
});
