import type {
  BetaContentBlock,
  BetaWebSearchResultBlock,
} from "@anthropic-ai/sdk/resources/beta/messages/messages.mjs";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mockCreate = vi.hoisted(() =>
  vi.fn<
    () => {
      content: BetaContentBlock[];
      usage: { input_tokens: number; output_tokens: number };
    }
  >(),
);

vi.mock("@anthropic-ai/sdk", async (importOriginal) => {
  const { APIError } =
    await importOriginal<typeof import("@anthropic-ai/sdk")>();
  return {
    APIError,
    default: class {
      static APIError = APIError;
      beta = {
        messages: {
          create: mockCreate,
        },
      };
    },
  };
});

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
        {
          type: "text",
          text: "Paris is the capital of France.",
          citations: [],
        },
        {
          type: "web_search_tool_result",
          caller: { type: "direct" },
          content: [
            {
              type: "web_search_result",
              url: "https://example.com",
              encrypted_content: "",
              page_age: "0h",
              title: "",
            },
            {
              type: "web_search_result",
              url: "https://other.com",
              encrypted_content: "",
              page_age: "0h",
              title: "",
            },
          ],
          tool_use_id: "123",
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
        { type: "text", text: "Response", citations: [] },
        {
          type: "web_search_tool_result",
          content: [
            {
              type: "web_search_result",
              url: "https://example.com",
              encrypted_content: "",
              page_age: null,
              title: "",
            },
            {
              type: "web_search_result",
              url: undefined,
              encrypted_content: "",
              page_age: null,
              title: "",
            } as unknown as BetaWebSearchResultBlock,
          ],
          tool_use_id: "123",
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

  it("should throw InsufficientCreditError on 402 response", async () => {
    const { APIError: AnthropicAPIError } = await import("@anthropic-ai/sdk");
    const headers = new Headers();
    mockCreate.mockRejectedValue(
      AnthropicAPIError.generate(402, {}, "Payment required", headers),
    );

    const { default: queryClaude } =
      await import("~/lib/llm-visibility/claudeClient.server");

    const { isInsufficientCreditError } =
      await import("~/lib/llm-visibility/insufficientCreditError");

    const error = await queryClaude({
      maxRetries: 0,
      timeout: 0,
      query: "query",
    }).then(
      () => undefined,
      (error: unknown) => error,
    );

    expect(error).toBeDefined();
    expect(isInsufficientCreditError(error)).toBe(true);
  });

  it("should throw InsufficientCreditError on 429 response", async () => {
    const { APIError: AnthropicAPIError } = await import("@anthropic-ai/sdk");
    const headers = new Headers();
    mockCreate.mockRejectedValue(
      AnthropicAPIError.generate(429, {}, "Rate limit exceeded", headers),
    );

    const { default: queryClaude } =
      await import("~/lib/llm-visibility/claudeClient.server");

    const { isInsufficientCreditError } =
      await import("~/lib/llm-visibility/insufficientCreditError");
    const error = await queryClaude({
      maxRetries: 0,
      timeout: 0,
      query: "query",
    }).then(
      () => undefined,
      (error: unknown) => error,
    );

    expect(error).toBeDefined();
    expect(isInsufficientCreditError(error)).toBe(true);
  });

  it("should not throw InsufficientCreditError on other errors", async () => {
    const { APIError: AnthropicAPIError } = await import("@anthropic-ai/sdk");
    const headers = new Headers();
    mockCreate.mockRejectedValue(
      AnthropicAPIError.generate(500, {}, "Internal Server Error", headers),
    );

    const { default: queryClaude } =
      await import("~/lib/llm-visibility/claudeClient.server");

    const { isInsufficientCreditError } =
      await import("~/lib/llm-visibility/insufficientCreditError");
    const error = await queryClaude({
      maxRetries: 0,
      timeout: 0,
      query: "query",
    }).then(
      () => undefined,
      (error: unknown) => error,
    );

    expect(error).toBeDefined();
    expect(isInsufficientCreditError(error)).toBe(false);
  });

  it("should deduplicate citations", async () => {
    mockCreate.mockResolvedValue({
      content: [
        { type: "text", text: "Response", citations: [] },
        {
          type: "web_search_tool_result",
          content: [
            {
              type: "web_search_result",
              url: "https://example.com",
              encrypted_content: "",
              page_age: null,
              title: "",
            },
            {
              type: "web_search_result",
              url: "https://example.com",
              encrypted_content: "",
              page_age: null,
              title: "",
            },
          ],
          tool_use_id: "123",
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
