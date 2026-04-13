import OpenAI from "openai";
import envVars from "../envVars.server";

const client = new OpenAI({
  apiKey: envVars.ZHIPU_API_KEY,
  baseURL: "https://api.z.ai/api/paas/v4/",
  fetch: process.env.NODE_ENV === "test" ? global.fetch : undefined,
});

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

  const completion = await client.chat.completions.create({
    model: "glm-4.5",
    messages: [
      {
        role: "system" as const,
        content:
          "You are a concise analytics assistant. Write 3-5 plain-English sentences summarizing which AI bots are crawling a website. Focus on the most active bots and which pages they visit most. Be direct — no preamble, no 'In summary'. One observation per sentence. Do not use markdown formatting.",
      },
      {
        role: "user" as const,
        content: `Domain: ${domain}\nLast 7 days of bot activity:\n${statLines}`,
      },
    ],
  });

  return completion.choices[0].message.content ?? "";
}
