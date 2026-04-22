import { generateRobotsTxt } from "@forge42/seo-tools/robots";
import envVars from "~/lib/envVars.server";

function splitSitemapLines(content: string): string {
  return content.replace(
    /^Sitemap: (.+)$/gm,
    (_, urls: string) =>
      urls
        .split(",")
        .map((url: string) => `Sitemap: ${url.trim()}`)
        .join("\n"),
  );
}

export async function loader() {
  const robotsTxt = generateRobotsTxt([
    {
      // NOTE: userAgent must show first
      userAgent: "*",
      allow: ["/"],
      disallow: ["/error"],
      sitemap: [
        new URL("/sitemap.xml", envVars.VITE_APP_URL).toString(),
        new URL("/sitemap.txt", envVars.VITE_APP_URL).toString(),
        "https://blog.cite.me.in/sitemap.xml",
      ],
    },
    { userAgent: "anthropic-ai", allow: ["/"] },
    { userAgent: "Bingbot", allow: ["/"] },
    { userAgent: "ChatGPT-User", allow: ["/"] },
    { userAgent: "Claude-User", allow: ["/"] },
    { userAgent: "ClaudeBot", allow: ["/"] },
    { userAgent: "Googlebot", allow: ["/"] },
    { userAgent: "GPTBot", allow: ["/"] },
    { userAgent: "Manus-User", allow: ["/"] },
    { userAgent: "Meta-ExternalFetcher", allow: ["/"] },
    { userAgent: "OAI-SearchBot", allow: ["/"] },
    { userAgent: "Perplexity-User", allow: ["/"] },
    { userAgent: "PerplexityBot", allow: ["/"] },
  ]);

  return new Response(splitSitemapLines(robotsTxt), {
    headers: { "Content-Type": "text/plain" },
  });
}
