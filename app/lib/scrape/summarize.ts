import OpenAI from "openai";
import envVars from "~/lib/envVars.server";

const client = new OpenAI({
  apiKey: envVars.ZHIPU_API_KEY,
  baseURL: "https://api.z.ai/api/paas/v4/",
});

/**
 * Summarize the given content. Used to generate a summary for a site based on
 * the content.
 *
 * @param content - The content to summarize.
 * @returns The summary.
 */
export default async function summarize({
  domain,
  content,
}: {
  domain: string;
  content: string;
}): Promise<string> {
  const response = await client.chat.completions.create({
    model: "glm-4.5",
    messages: [
      {
        role: "system",
        content: `You are a summary generator. You are given the content of ${domain} and you need to summarize it. Be concise and to the point. Limit to two sentences, 200 characters. Do not include title or any other formatting.`,
      },
      {
        role: "user",
        content: content,
      },
    ],
  });
  return response.choices[0].message.content ?? "";
}
