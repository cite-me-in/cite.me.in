import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mockCreate = vi.hoisted(() =>
  vi.fn<
    () => Promise<{
      output: {
        type: string;
        content: {
          type: "output_text";
          text: string;
          annotations: (
            | { type: "url_citation"; url: string }
            | { type: "other"; id: string }
          )[];
        }[];
      }[];
      usage: {
        input_tokens: number;
        output_tokens: number;
      };
    }>
  >(),
);

vi.mock("openai", async (importOriginal) => {
  const { APIError } = await importOriginal<typeof import("openai")>();
  return {
    APIError,
    default: class {
      static APIError = APIError;
      responses = {
        create: mockCreate,
      };
    },
  };
});

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

    const { default: openaiClient } =
      await import("~/lib/llm-visibility/openaiClient.server");

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

    const { default: openaiClient } =
      await import("~/lib/llm-visibility/openaiClient.server");

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

    const { default: openaiClient } =
      await import("~/lib/llm-visibility/openaiClient.server");

    const result = await openaiClient({
      maxRetries: 0,
      timeout: 0,
      query: "query",
    });

    expect(result.citations).toEqual(["https://example.com"]);
  });

  it("should throw InsufficientCreditError on 402 response", async () => {
    const { APIError } = await import("openai");
    mockCreate.mockRejectedValue(
      new APIError(402, {}, "Payment required", new Headers()),
    );

    const { default: openaiClient } =
      await import("~/lib/llm-visibility/openaiClient.server");

    await expect(
      openaiClient({ maxRetries: 0, timeout: 0, query: "query" }),
    ).rejects.toThrow("chatgpt: insufficient credit (HTTP 402)");
  });

  it("should throw InsufficientCreditError on 429 response", async () => {
    const { APIError } = await import("openai");
    mockCreate.mockRejectedValue(
      new APIError(429, {}, "Rate limit exceeded", new Headers()),
    );

    const { default: openaiClient } =
      await import("~/lib/llm-visibility/openaiClient.server");

    await expect(
      openaiClient({ maxRetries: 0, timeout: 0, query: "query" }),
    ).rejects.toThrow("chatgpt: insufficient credit (HTTP 429)");
  });

  it("should throw InsufficientCreditError on insufficient_quota error code", async () => {
    const { APIError } = await import("openai");
    const error = new APIError(
      429,
      { code: "insufficient_quota" },
      "insufficient_quota",
      new Headers(),
    );

    mockCreate.mockRejectedValue(error);

    const { default: openaiClient } =
      await import("~/lib/llm-visibility/openaiClient.server");

    await expect(
      openaiClient({ maxRetries: 0, timeout: 0, query: "query" }),
    ).rejects.toThrow("chatgpt: insufficient credit (HTTP 429)");
  });

  it("should not throw InsufficientCreditError on other errors", async () => {
    const { APIError } = await import("openai");
    mockCreate.mockRejectedValue(
      new APIError(500, {}, "Internal Server Error", new Headers()),
    );

    const { default: openaiClient } =
      await import("~/lib/llm-visibility/openaiClient.server");

    await expect(
      openaiClient({ maxRetries: 0, timeout: 0, query: "query" }),
    ).rejects.toThrow("500");
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

    const { default: openaiClient } =
      await import("~/lib/llm-visibility/openaiClient.server");

    const result = await openaiClient({
      maxRetries: 0,
      timeout: 0,
      query: "query",
    });

    expect(result.citations).toEqual([]);
  });
});
