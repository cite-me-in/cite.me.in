/**
 * This can be used in the UI to display the platforms and their labels.
 */
export default [
  {
    label: "ChatGPT",
    modelId: "gpt-5-chat-latest",
    name: "chatgpt",
  },
  {
    label: "Claude",
    modelId: "claude-haiku-4-5-20251001",
    name: "claude",
  },
  {
    label: "Gemini",
    modelId: "gemini-2.5-flash",
    name: "gemini",
  },
  {
    label: "Perplexity",
    modelId: "sonar",
    name: "perplexity",
  },
] satisfies {
  label: string;
  modelId: string;
  name: string;
}[];
