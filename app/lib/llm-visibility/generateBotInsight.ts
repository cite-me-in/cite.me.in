import * as ai from "ai";
import { wrapAISDK } from "braintrust";
import { haiku } from "./claudeClient.server";

const { generateText } = wrapAISDK(ai);

export default async function generateBotInsight(
  domain: string,
  botStats: {
    botType: string;
    total: number;
    topPaths: string[];
  }[],
): Promise<string> {
  const statLines = botStats
    .map(
      (s) =>
        `- ${s.botType}: ${s.total} visits. Top pages: ${s.topPaths.join(", ")}`,
    )
    .join("\n");

  const { text } = await generateText({
    model: haiku,
    messages: [
      {
        role: "system" as const,
        content:
          "You are a concise analytics assistant. Write 3-5 plain-English sentences summarizing which AI bots are crawling a website. Focus on the most active bots and which pages they visit most. Be direct — no preamble, no 'In summary'. One observation per sentence.",
      },
      {
        role: "user" as const,
        content: `Domain: ${domain}\nLast 7 days of bot activity:\n${statLines}`,
      },
    ],
    maxOutputTokens: 300,
  });

  return text;
}
