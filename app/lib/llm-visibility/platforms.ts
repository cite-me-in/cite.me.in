import queryClaude from "~/lib/llm-visibility/claudeClient";
import queryGemini from "~/lib/llm-visibility/geminiClient";
import openaiClient from "~/lib/llm-visibility/openaiClient";
import queryPerplexity from "~/lib/llm-visibility/perplexityClient";
import type { QueryFn } from "~/lib/llm-visibility/queryFn";

const PLATFORMS: {
  platform: string;
  modelId: string;
  queryFn: QueryFn;
  label: string;
}[] = [
  {
    platform: "chatgpt",
    modelId: "gpt-5-chat-latest",
    queryFn: openaiClient,
    label: "ChatGPT",
  },
  {
    platform: "perplexity",
    modelId: "sonar",
    queryFn: queryPerplexity,
    label: "Perplexity",
  },
  {
    platform: "claude",
    modelId: "claude-haiku-4-5-20251001",
    queryFn: queryClaude,
    label: "Claude",
  },
  {
    platform: "gemini",
    modelId: "gemini-2.5-flash",
    queryFn: queryGemini,
    label: "Gemini",
  },
];

export default PLATFORMS;
