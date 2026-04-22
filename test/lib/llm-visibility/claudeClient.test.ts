import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    beta = {
      messages: {
        create: mockCreate,
      },
    };
  },
}));

vi.mock("~/lib/envVars.server", () => ({
  default: { ANTHROPIC_API_KEY: "test-key" },
}));

describe("queryClaude", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return citations from URL sources and the response text", async () => {
    mockCreate.mockResolvedValue({
      content: [
        { type: "text", text: "Paris is the capital of France." },
        {
          type: "web_search_tool_result",
          content: [
            { type: "web_search_result", url: "https://example.com" },
            { type: "web_search_result", url: "https://other.com" },
          ],
        },
      ],
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    const { default: queryClaude } =
      await import("~/lib/llm-visibility/claudeClient.server");

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

  it("should filter out sources without URLs", async () => {
    mockCreate.mockResolvedValue({
      content: [
        { type: "text", text: "Response" },
        {
          type: "web_search_tool_result",
          content: [
            { type: "web_search_result", url: "https://example.com" },
            { type: "web_search_result", url: undefined },
          ],
        },
      ],
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    const { default: queryClaude } =
      await import("~/lib/llm-visibility/claudeClient.server");

    const result = await queryClaude({
      maxRetries: 0,
      timeout: 0,
      query: "query",
    });

    expect(result.citations).toEqual(["https://example.com"]);
  });

  it("should deduplicate citations", async () => {
    mockCreate.mockResolvedValue({
      content: [
        { type: "text", text: "Response" },
        {
          type: "web_search_tool_result",
          content: [
            { type: "web_search_result", url: "https://example.com" },
            { type: "web_search_result", url: "https://example.com" },
          ],
        },
      ],
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    const { default: queryClaude } =
      await import("~/lib/llm-visibility/claudeClient.server");

    const result = await queryClaude({
      maxRetries: 0,
      timeout: 0,
      query: "query",
    });

    expect(result.citations).toEqual(["https://example.com"]);
  });
});
