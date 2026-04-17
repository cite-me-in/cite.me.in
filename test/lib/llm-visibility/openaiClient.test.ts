import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock("openai", () => ({
  default: class {
    responses = {
      create: mockCreate,
    };
  },
}));

vi.mock("~/lib/envVars.server", () => ({
  default: { OPENAI_API_KEY: "test-key" },
}));

describe("openaiClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return citations from URL annotations and the response text", async () => {
    mockCreate.mockResolvedValue({
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: "Paris is the capital of France.",
              annotations: [
                { type: "url_citation", url: "https://example.com" },
                { type: "url_citation", url: "https://other.com" },
              ],
            },
          ],
        },
      ],
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    const { default: openaiClient } = await import(
      "~/lib/llm-visibility/openaiClient"
    );

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

  it("should filter out non-URL annotations", async () => {
    mockCreate.mockResolvedValue({
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: "Response",
              annotations: [
                { type: "url_citation", url: "https://example.com" },
                { type: "other", id: "doc-1" },
              ],
            },
          ],
        },
      ],
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    const { default: openaiClient } = await import(
      "~/lib/llm-visibility/openaiClient"
    );

    const result = await openaiClient({
      maxRetries: 0,
      timeout: 0,
      query: "query",
    });

    expect(result.citations).toEqual(["https://example.com"]);
  });

  it("should deduplicate citations", async () => {
    mockCreate.mockResolvedValue({
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: "Response",
              annotations: [
                { type: "url_citation", url: "https://example.com" },
                { type: "url_citation", url: "https://example.com" },
              ],
            },
          ],
        },
      ],
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    const { default: openaiClient } = await import(
      "~/lib/llm-visibility/openaiClient"
    );

    const result = await openaiClient({
      maxRetries: 0,
      timeout: 0,
      query: "query",
    });

    expect(result.citations).toEqual(["https://example.com"]);
  });

  it("should return empty citations when there are no annotations", async () => {
    mockCreate.mockResolvedValue({
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: "I don't know.",
              annotations: [],
            },
          ],
        },
      ],
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    const { default: openaiClient } = await import(
      "~/lib/llm-visibility/openaiClient"
    );

    const result = await openaiClient({
      maxRetries: 0,
      timeout: 0,
      query: "query",
    });

    expect(result.citations).toEqual([]);
  });
});
