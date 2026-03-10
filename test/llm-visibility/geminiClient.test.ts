import { generateText } from "ai";
import { describe, expect, it, vi } from "vitest";
import queryGemini from "~/lib/llm-visibility/geminiClient";

vi.mock("~/lib/envVars", () => ({
  default: { GOOGLE_GENERATIVE_AI_API_KEY: "test-key" },
}));

vi.mock("@ai-sdk/google", () => {
  const google = Object.assign(
    vi.fn(() => "mock-model"),
    {
      tools: { googleSearch: vi.fn(() => "mock-google-search") },
    },
  );
  return { google };
});

vi.mock("ai", () => ({
  generateText: vi.fn(),
}));

describe("queryGemini", () => {
  it("returns citations resolved from redirect URLs and extraQueries", async () => {
    vi.mocked(generateText).mockResolvedValue({
      providerMetadata: {
        google: {
          groundingMetadata: {
            webSearchQueries: ["capital of France"],
            groundingChunks: [
              { web: { uri: "https://redirect.example.com/1" } },
              { web: { uri: "https://redirect.example.com/2" } },
            ],
          },
        },
      },
      text: "Paris is the capital of France.",
    } as never);

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ url: "https://example.com/final-1" })
        .mockResolvedValueOnce({ url: "https://example.com/final-2" }),
    );

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

  it("follows redirects when resolving citation URLs", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ url: "https://final.example.com" });
    vi.stubGlobal("fetch", fetchMock);

    vi.mocked(generateText).mockResolvedValue({
      providerMetadata: {
        google: {
          groundingMetadata: {
            webSearchQueries: [],
            groundingChunks: [{ web: { uri: "https://redirect.example.com" } }],
          },
        },
      },
      text: "Response",
    } as never);

    await queryGemini({
      maxRetries: 0,
      timeout: 0,
      query: "query",
    });

    expect(fetchMock).toHaveBeenCalledWith("https://redirect.example.com", {
      redirect: "follow",
    });
  });

  it("returns empty citations and extraQueries when providerMetadata is absent", async () => {
    vi.stubGlobal("fetch", vi.fn());
    vi.mocked(generateText).mockResolvedValue({
      providerMetadata: undefined,
      text: "I don't know.",
    } as never);

    const result = await queryGemini({
      maxRetries: 0,
      timeout: 0,
      query: "query",
    });

    expect(result.citations).toEqual([]);
    expect(result.extraQueries).toEqual([]);
  });
});
