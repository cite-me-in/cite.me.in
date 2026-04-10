import { afterEach, describe, expect, it, vi } from "vitest";

const mockCreate = vi.fn();

class MockOpenAI {
  chat = {
    completions: {
      create: mockCreate,
    },
  };
}

vi.mock("openai", () => ({
  default: MockOpenAI,
}));

afterEach(() => {
  mockCreate.mockReset();
});

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
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("should return parsed sentiment from completion", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: '{"label":"positive","summary":"Great visibility."}',
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

    expect(result).toEqual({ label: "positive", summary: "Great visibility." });
  });

  it("should handle all sentiment labels", async () => {
    const labels = ["positive", "negative", "neutral", "mixed"] as const;

    for (const label of labels) {
      mockCreate.mockResolvedValueOnce({
        choices: [
          { message: { content: `{"label":"${label}","summary":"Test"}` } },
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
    let capturedMessages: { role: string; content: string; }[] | undefined;
    mockCreate.mockImplementationOnce(
      async (args: { messages: typeof capturedMessages; }) => {
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
    let capturedMessages: { role: string; content: string; }[] | undefined;
    mockCreate.mockImplementationOnce(
      async (args: { messages: typeof capturedMessages; }) => {
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
    let capturedMessages: { role: string; content: string; }[] | undefined;
    mockCreate.mockImplementationOnce(
      async (args: { messages: typeof capturedMessages; }) => {
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
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: '```json\n{"label":"positive","summary":"Good"}\n```',
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

    expect(result).toEqual({ label: "positive", summary: "Good" });
  });

  it("should return neutral on JSON parse error", async () => {
    mockCreate.mockResolvedValueOnce({
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
    });
  });

  it("should return neutral on invalid schema", async () => {
    mockCreate.mockResolvedValueOnce({
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
    });
  });

  it("should return neutral on missing fields", async () => {
    mockCreate.mockResolvedValueOnce({
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
    });
  });

  it("should propagate API errors", async () => {
    mockCreate.mockRejectedValueOnce(new Error("API error"));

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
});
