import { afterEach, describe, expect, it, vi } from "vitest";

const mockCreate = vi.fn<
  (args: { messages: { role: string; content: string }[] }) => Promise<{
    choices: { message: { content: string } }[];
  }>
>();

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

describe("generateBotInsight", () => {
  it("should return the text from the completion", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "GPTBot visited 47 times this week." } }],
    });

    const { default: generateBotInsight } = await import("~/lib/llm-visibility/generateBotInsight");

    const result = await generateBotInsight("example.com", [
      { botType: "ChatGPT", total: 47, topPaths: ["/", "/blog"] },
    ]);

    expect(result).toBe("GPTBot visited 47 times this week.");
  });

  it("should include domain and bot stats in the user message", async () => {
    let capturedMessages: { role: string; content: string }[] | undefined;
    mockCreate.mockImplementationOnce(async (args: { messages: typeof capturedMessages }) => {
      capturedMessages = args.messages;
      return { choices: [{ message: { content: "insight" } }] };
    });

    const { default: generateBotInsight } = await import("~/lib/llm-visibility/generateBotInsight");

    await generateBotInsight("mysite.com", [
      { botType: "Claude", total: 5, topPaths: ["/about"] },
      { botType: "Gemini", total: 12, topPaths: ["/", "/faq"] },
    ]);

    const userMsg = capturedMessages?.find((m) => m.role === "user");
    expect(userMsg?.content).toContain("Domain: mysite.com");
    expect(userMsg?.content).toContain("- Claude: 5 visits. Top pages: /about");
    expect(userMsg?.content).toContain("- Gemini: 12 visits. Top pages: /, /faq");
  });

  it("should propagate errors from the completion", async () => {
    mockCreate.mockRejectedValueOnce(new Error("API error"));

    const { default: generateBotInsight } = await import("~/lib/llm-visibility/generateBotInsight");

    await expect(generateBotInsight("example.com", [])).rejects.toThrow("API error");
  });
});
