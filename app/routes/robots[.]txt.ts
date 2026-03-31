import { generateRobotsTxt } from "@forge42/seo-tools/robots";

export async function loader() {
  const robotsTxt = generateRobotsTxt([
    {
      // NOTE: userAgent must show first
      userAgent: "*",
      allow: ["/"],
      disallow: ["/error"],
      sitemap: [
        new URL("/sitemap.xml", import.meta.env.VITE_APP_URL).toString(),
      ],
    },
    { userAgent: "anthropic-ai", allow: ["/"] },
    { userAgent: "Bingbot", allow: ["/"] },
    { userAgent: "ChatGPT-User", allow: ["/"] },
    { userAgent: "ClaudeBot", allow: ["/"] },
    { userAgent: "Googlebot", allow: ["/"] },
    { userAgent: "GPTBot", allow: ["/"] },
    { userAgent: "PerplexityBot", allow: ["/"] },
  ]);

  return new Response(robotsTxt, {
    headers: { "Content-Type": "text/plain" },
  });
}
