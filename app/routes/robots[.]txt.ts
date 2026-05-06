import envVars from "~/lib/envVars.server";

const robots = [
  ["User-agent: *", "Allow: /"],
  ["Disallow: /error"],
  ["# Declare content usage signals:"],
  ["Content-Signal: search=yes, ai-input=yes, ai-train=no"],
  [
    `Sitemap: ${new URL("/sitemap.xml", envVars.VITE_APP_URL).toString()}`,
    `Sitemap: ${new URL("/sitemap.txt", envVars.VITE_APP_URL).toString()}`,
  ],
  ["User-agent: anthropic-ai", "Allow: /"],
  ["User-agent: Bingbot", "Allow: /"],
  ["User-agent: ChatGPT-User", "Allow: /"],
  ["User-agent: Claude-User", "Allow: /"],
  ["User-agent: ClaudeBot", "Allow: /"],
  ["User-agent: Googlebot", "Allow: /"],
  ["User-agent: GPTBot", "Allow: /"],
  ["User-agent: Manus-User", "Allow: /"],
  ["User-agent: Meta-ExternalFetcher", "Allow: /"],
  ["User-agent: OAI-SearchBot", "Allow: /"],
  ["User-agent: Perplexity-User", "Allow: /"],
  ["User-agent: PerplexityBot", "Allow: /"],
  [`LLMs.txt: ${new URL("/llms.txt", envVars.VITE_APP_URL).toString()}`],
  [
    `LLMs-full.txt: ${new URL("/llms-full.txt", envVars.VITE_APP_URL).toString()}`,
  ],
];

export async function loader() {
  return new Response(robots.flat().join("\n"), {
    headers: { "Content-Type": "text/plain" },
  });
}
