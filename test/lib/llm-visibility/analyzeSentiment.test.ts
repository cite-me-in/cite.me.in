import { afterEach, describe, expect, it, vi } from "vitest";

const mockComplete = vi.fn();

class MockOpenAI {
  chat = { completions: { create: mockComplete, }, };
}

vi.mock("openai", () => ({ default: MockOpenAI, }));

afterEach(() => { mockComplete.mockReset(); });

describe("analyzeSentiment", () => {
  it("should return neutral when no queries provided", async () => {
    const { default: analyzeSentiment } = await import(
      "~/lib/llm-visibility/analyzeSentiment"
    );

    const result = await analyzeSentiment({
      domain: "example.com",
      queries: [],
    });

    expect(result).toEqual({
      label: "neutral",
      summary: "No queries were run for this platform.",
      citations: [],
    });
    expect(mockComplete).not.toHaveBeenCalled();
  });

  it("should return parsed sentiment from completion", async () => {
    mockComplete.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content:
              '{"label":"positive","summary":"Great visibility.","citations":[]}',
          },
        },
      ],
    });

    const { default: analyzeSentiment } = await import(
      "~/lib/llm-visibility/analyzeSentiment"
    );

    const result = await analyzeSentiment({
      domain: "example.com",
      queries: [{ query: "test", citations: [], text: "response" }],
    });

    expect(result).toEqual({
      label: "positive",
      summary: "Great visibility.",
      citations: [],
    });
  });

  it("should handle all sentiment labels", async () => {
    const labels = ["positive", "negative", "neutral", "mixed"] as const;

    for (const label of labels) {
      mockComplete.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: `{"label":"${label}","summary":"Test","citations":[]}`,
            },
          },
        ],
      });

      const { default: analyzeSentiment } = await import(
        "~/lib/llm-visibility/analyzeSentiment"
      );

      const result = await analyzeSentiment({
        domain: "example.com",
        queries: [{ query: "test", citations: [], text: "response" }],
      });

      expect(result.label).toBe(label);
    }
  });

  it("should include domain and query data in the user message", async () => {
    let capturedMessages: { role: string; content: string }[] | undefined;
    mockComplete.mockImplementationOnce(
      async (args: { messages: typeof capturedMessages }) => {
        capturedMessages = args.messages;
        return {
          choices: [
            { message: { content: '{"label":"neutral","summary":"test"}' } },
          ],
        };
      },
    );

    const { default: analyzeSentiment } = await import(
      "~/lib/llm-visibility/analyzeSentiment"
    );

    await analyzeSentiment({
      domain: "mysite.com",
      queries: [
        {
          query: "what is mysite",
          citations: ["https://mysite.com/", "https://other.com/"],
          text: "response text",
        },
      ],
    });

    const userMsg = capturedMessages?.find((m) => m.role === "user");
    expect(userMsg?.content).toContain("Domain: mysite.com");
    expect(userMsg?.content).toContain("Query: what is mysite");
    expect(userMsg?.content).toContain("response text");
  });

  it("should calculate citation position when found", async () => {
    let capturedMessages: { role: string; content: string }[] | undefined;
    mockComplete.mockImplementationOnce(
      async (args: { messages: typeof capturedMessages }) => {
        capturedMessages = args.messages;
        return {
          choices: [
            { message: { content: '{"label":"neutral","summary":"test"}' } },
          ],
        };
      },
    );

    const { default: analyzeSentiment } = await import(
      "~/lib/llm-visibility/analyzeSentiment"
    );

    await analyzeSentiment({
      domain: "mysite.com",
      queries: [
        {
          query: "test",
          citations: ["https://other.com/", "https://mysite.com/page"],
          text: "response",
        },
      ],
    });

    const userMsg = capturedMessages?.find((m) => m.role === "user");
    expect(userMsg?.content).toContain("cited at position #2");
  });

  it("should report not cited when not found", async () => {
    let capturedMessages: { role: string; content: string }[] | undefined;
    mockComplete.mockImplementationOnce(
      async (args: { messages: typeof capturedMessages }) => {
        capturedMessages = args.messages;
        return {
          choices: [
            { message: { content: '{"label":"neutral","summary":"test"}' } },
          ],
        };
      },
    );

    const { default: analyzeSentiment } = await import(
      "~/lib/llm-visibility/analyzeSentiment"
    );

    await analyzeSentiment({
      domain: "mysite.com",
      queries: [
        {
          query: "test",
          citations: ["https://other.com/", "https://another.com/"],
          text: "response",
        },
      ],
    });

    const userMsg = capturedMessages?.find((m) => m.role === "user");
    expect(userMsg?.content).toContain("not cited");
  });

  it("should strip markdown fences from response", async () => {
    mockComplete.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content:
              '```json\n{"label":"positive","summary":"Good","citations":[]}\n```',
          },
        },
      ],
    });

    const { default: analyzeSentiment } = await import(
      "~/lib/llm-visibility/analyzeSentiment"
    );

    const result = await analyzeSentiment({
      domain: "example.com",
      queries: [{ query: "test", citations: [], text: "response" }],
    });

    expect(result).toEqual({
      label: "positive",
      summary: "Good",
      citations: [],
    });
  });

  it("should return neutral on JSON parse error", async () => {
    mockComplete.mockResolvedValueOnce({
      choices: [{ message: { content: "not valid json" } }],
    });

    const { default: analyzeSentiment } = await import(
      "~/lib/llm-visibility/analyzeSentiment"
    );

    const result = await analyzeSentiment({
      domain: "example.com",
      queries: [{ query: "test", citations: [], text: "response" }],
    });

    expect(result).toEqual({
      label: "neutral",
      summary: "Sentiment analysis unavailable.",
      citations: [],
    });
  });

  it("should return neutral on invalid schema", async () => {
    mockComplete.mockResolvedValueOnce({
      choices: [
        { message: { content: '{"label":"invalid","summary":"test"}' } },
      ],
    });

    const { default: analyzeSentiment } = await import(
      "~/lib/llm-visibility/analyzeSentiment"
    );

    const result = await analyzeSentiment({
      domain: "example.com",
      queries: [{ query: "test", citations: [], text: "response" }],
    });

    expect(result).toEqual({
      label: "neutral",
      summary: "Sentiment analysis unavailable.",
      citations: [],
    });
  });

  it("should return neutral on missing fields", async () => {
    mockComplete.mockResolvedValueOnce({
      choices: [{ message: { content: '{"label":"positive"}' } }],
    });

    const { default: analyzeSentiment } = await import(
      "~/lib/llm-visibility/analyzeSentiment"
    );

    const result = await analyzeSentiment({
      domain: "example.com",
      queries: [{ query: "test", citations: [], text: "response" }],
    });

    expect(result).toEqual({
      label: "neutral",
      summary: "Sentiment analysis unavailable.",
      citations: [],
    });
  });

  it("should propagate API errors", async () => {
    mockComplete.mockRejectedValueOnce(new Error("API error"));

    const { default: analyzeSentiment } = await import(
      "~/lib/llm-visibility/analyzeSentiment"
    );

    await expect(
      analyzeSentiment({
        domain: "example.com",
        queries: [{ query: "test", citations: [], text: "response" }],
      }),
    ).rejects.toThrow("API error");
  });

  it("should return classified citations", async () => {
    mockComplete.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              label: "positive",
              summary: "Good visibility.",
              citations: [
                {
                  url: "https://shop.example.com/",
                  relationship: "direct",
                  reason: "subdomain",
                },
                {
                  url: "https://blog.other.com/article-about-example",
                  relationship: "indirect",
                  reason: "article about brand",
                },
                { url: "https://unrelated.com/", relationship: "unrelated" },
              ],
            }),
          },
        },
      ],
    });

    const { default: analyzeSentiment } = await import(
      "~/lib/llm-visibility/analyzeSentiment"
    );

    const result = await analyzeSentiment({
      domain: "example.com",
      queries: [
        {
          query: "test",
          citations: [
            "https://shop.example.com/",
            "https://blog.other.com/article-about-example",
            "https://unrelated.com/",
          ],
          text: "response",
        },
      ],
    });

    expect(result.label).toBe("positive");
    expect(result.citations).toHaveLength(3);
    expect(result.citations[0]).toEqual({
      url: "https://shop.example.com/",
      relationship: "direct",
      reason: "subdomain",
    });
    expect(result.citations[1]).toEqual({
      url: "https://blog.other.com/article-about-example",
      relationship: "indirect",
      reason: "article about brand",
    });
  });

  it("should include unique citations list in user message", async () => {
    let capturedMessages: { role: string; content: string }[] | undefined;
    mockComplete.mockImplementationOnce(
      async (args: { messages: typeof capturedMessages }) => {
        capturedMessages = args.messages;
        return {
          choices: [
            {
              message: {
                content: '{"label":"neutral","summary":"test","citations":[]}',
              },
            },
          ],
        };
      },
    );

    const { default: analyzeSentiment } = await import(
      "~/lib/llm-visibility/analyzeSentiment"
    );

    await analyzeSentiment({
      domain: "example.com",
      queries: [
        {
          query: "test1",
          citations: ["https://a.com/", "https://b.com/"],
          text: "response1",
        },
        {
          query: "test2",
          citations: ["https://b.com/", "https://c.com/"],
          text: "response2",
        },
      ],
    });

    const userMsg = capturedMessages?.find((m) => m.role === "user");
    expect(userMsg?.content).toContain("https://a.com/");
    expect(userMsg?.content).toContain("https://b.com/");
    expect(userMsg?.content).toContain("https://c.com/");
  });
});
