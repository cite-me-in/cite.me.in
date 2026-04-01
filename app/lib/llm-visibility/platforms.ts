/**
 * This can be used in the UI to display the platforms and their labels.
 */
export default [
  { label: "Bing", modelId: "bing", name: "bing" },
  { label: "CoPilot", modelId: "copilot", name: "copilot" },
  { label: "ChatGPT", modelId: "gpt-5-chat-latest", name: "chatgpt" },
  { label: "Claude", modelId: "claude-haiku-4-5-20251001", name: "claude" },
  { label: "Gemini", modelId: "gemini-2.5-flash", name: "gemini" },
  {
    label: "Google AI Mode",
    modelId: "google-ai-mode",
    name: "google-ai-mode",
  },
  { label: "Google", modelId: "google", name: "google" },
  { label: "Perplexity", modelId: "sonar", name: "perplexity" },
] satisfies {
  label: string;
  modelId: string;
  name: string;
}[];
