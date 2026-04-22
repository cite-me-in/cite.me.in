import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mockGenerateContent = vi.hoisted(() => vi.fn());

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = {
      generateContent: mockGenerateContent,
    };
  },
}));

vi.mock("~/lib/envVars.server", () => ({
  default: { GOOGLE_GENERATIVE_AI_API_KEY: "test-key" },
}));

describe("queryGemini", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return citations resolved from redirect URLs and extraQueries", async () => {
    mockGenerateContent.mockResolvedValue({
      text: "Paris is the capital of France.",
      candidates: [
        {
          groundingMetadata: {
            webSearchQueries: ["capital of France"],
            groundingChunks: [
              {
                web: {
                  uri: "https://redirect.example.com/1",
                  title: "Source 1",
                },
              },
              {
                web: {
                  uri: "https://redirect.example.com/2",
                  title: "Source 2",
                },
              },
            ],
          },
        },
      ],
      usageMetadata: {
        promptTokenCount: 100,
        candidatesTokenCount: 50,
      },
    });

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ url: "https://example.com/final-1" })
        .mockResolvedValueOnce({ url: "https://example.com/final-2" }),
    );

    const { default: queryGemini } =
      await import("~/lib/llm-visibility/geminiClient.server");

    const result = await queryGemini({
      maxRetries: 0,
      timeout: 0,
      query: "What is the capital of France?",
    });

    expect(result.citations).toEqual([
      "https://example.com/final-1",
      "https://example.com/final-2",
    ]);
    expect(result.text).toBe("Paris is the capital of France.");
    expect(result.extraQueries).toEqual(["capital of France"]);
  });

  it("should follow redirects when resolving citation URLs", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ url: "https://final.example.com" });
    vi.stubGlobal("fetch", fetchMock);

    mockGenerateContent.mockResolvedValue({
      text: "Response",
      candidates: [
        {
          groundingMetadata: {
            webSearchQueries: [],
            groundingChunks: [
              { web: { uri: "https://redirect.example.com", title: "Source" } },
            ],
          },
        },
      ],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
    });

    const { default: queryGemini } =
      await import("~/lib/llm-visibility/geminiClient.server");

    await queryGemini({
      maxRetries: 0,
      timeout: 0,
      query: "query",
    });

    expect(fetchMock).toHaveBeenCalledWith("https://redirect.example.com", {
      signal: expect.any(AbortSignal),
      redirect: "follow",
    });
  });

  it("should return empty citations and extraQueries when groundingMetadata is absent", async () => {
    vi.stubGlobal("fetch", vi.fn());

    mockGenerateContent.mockResolvedValue({
      text: "I don't know.",
      candidates: [{}],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
    });

    const { default: queryGemini } =
      await import("~/lib/llm-visibility/geminiClient.server");

    const result = await queryGemini({
      maxRetries: 0,
      timeout: 0,
      query: "query",
    });

    expect(result.citations).toEqual([]);
    expect(result.extraQueries).toEqual([]);
  });

  it("should handle empty candidates array", async () => {
    vi.stubGlobal("fetch", vi.fn());

    mockGenerateContent.mockResolvedValue({
      text: "Response without grounding",
      candidates: [],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
    });

    const { default: queryGemini } =
      await import("~/lib/llm-visibility/geminiClient.server");

    const result = await queryGemini({
      maxRetries: 0,
      timeout: 0,
      query: "query",
    });

    expect(result.citations).toEqual([]);
    expect(result.extraQueries).toEqual([]);
  });
});
