/**
 * This can be used in the UI to display the platforms and their labels.
 */
export default [
  { label: "Copilot", model: "copilot", name: "copilot" },
  { label: "ChatGPT", model: "gpt-5-chat-latest", name: "chatgpt" },
  { label: "Claude", model: "claude-haiku-4-5-20251001", name: "claude" },
  { label: "Gemini", model: "gemini-2.5-flash", name: "gemini" },
  { label: "Perplexity", model: "sonar", name: "perplexity" },
] satisfies {
  label: string;
  model: string;
  name: string;
}[];
