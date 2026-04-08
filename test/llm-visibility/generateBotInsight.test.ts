import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateText } from "ai";
import generateBotInsight from "~/lib/llm-visibility/generateBotInsight";

vi.mock("ai", () => ({ generateText: vi.fn(), gateway: vi.fn() }));
vi.mock("~/lib/llm-visibility/anthropic", () => ({
  haiku: "mock-haiku-model",
}));

describe("generateBotInsight", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return the text from generateText", async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: "GPTBot visited 47 times this week.",
    } as never);

    const result = await generateBotInsight("example.com", [
      { botType: "ChatGPT", total: 47, topPaths: ["/", "/blog"] },
    ]);

    expect(result).toBe("GPTBot visited 47 times this week.");
  });

  it("should include domain and bot stats in the user message", async () => {
    vi.mocked(generateText).mockResolvedValue({ text: "insight" } as never);

    await generateBotInsight("mysite.com", [
      { botType: "Claude", total: 5, topPaths: ["/about"] },
      { botType: "Gemini", total: 12, topPaths: ["/", "/faq"] },
    ]);

    const call = vi.mocked(generateText).mock.calls[0][0];
    const messages = call.messages as { role: string; content: string }[];
    const userMsg = messages.find((m) => m.role === "user");
    expect(userMsg?.content).toContain("Domain: mysite.com");
    expect(userMsg?.content).toContain("- Claude: 5 visits. Top pages: /about");
    expect(userMsg?.content).toContain(
      "- Gemini: 12 visits. Top pages: /, /faq",
    );
  });

  it("should propagate errors from generateText", async () => {
    vi.mocked(generateText).mockRejectedValue(new Error("API error"));

    await expect(generateBotInsight("example.com", [])).rejects.toThrow(
      "API error",
    );
  });
});
