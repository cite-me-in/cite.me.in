import * as ai from "ai";
import { wrapAISDK } from "braintrust";
import { haiku } from "../llm-visibility/anthropic";

const { generateText } = wrapAISDK(ai);

/**
 * Summarize the given content. Used to generate a summary for a site based on
 * the content.
 *
 * @param content - The content to summarize.
 * @returns The summary.
 */
export async function summarize({
  domain,
  content,
}: {
  domain: string;
  content: string;
}): Promise<string> {
  const { text: summary } = await generateText({
    model: haiku,
    prompt: [
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
  return summary;
}
