const PLATFORMS: {
  name: string;
  modelId: string;
  label: string;
}[] = [
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
];

export default PLATFORMS;
