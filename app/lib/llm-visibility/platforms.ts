import queryClaude from "~/lib/llm-visibility/claudeClient";
import queryGemini from "~/lib/llm-visibility/geminiClient";
import openaiClient from "~/lib/llm-visibility/openaiClient";
import queryPerplexity from "~/lib/llm-visibility/perplexityClient";
import type { QueryFn } from "~/lib/llm-visibility/queryFn";

const PLATFORMS: {
  name: string;
  modelId: string;
  queryFn: QueryFn;
  label: string;
}[] = [
  {
    label: "ChatGPT",
    modelId: "gpt-5-chat-latest",
    name: "chatgpt",
    queryFn: openaiClient,
  },
  {
    label: "Claude",
    modelId: "claude-haiku-4-5-20251001",
    name: "claude",
    queryFn: queryClaude,
  },
  {
    label: "Gemini",
    modelId: "gemini-2.5-flash",
    name: "gemini",
    queryFn: queryGemini,
  },
  {
    label: "Perplexity",
    modelId: "sonar",
    name: "perplexity",
    queryFn: queryPerplexity,
  },
];

export default PLATFORMS;
