import { generateRobotsTxt } from "@forge42/seo-tools/robots";
import envVars from "~/lib/envVars";

export async function loader() {
  const robotsTxt = generateRobotsTxt([
    {
      // NOTE: userAgent must show first
      userAgent: "*",
      allow: ["/"],
      disallow: ["/error"],
      sitemap: [`${envVars.APP_URL}/sitemap.xml`],
    },
    { userAgent: "GPTBot", allow: ["/"] },
    { userAgent: "ChatGPT-User", allow: ["/"] },
    { userAgent: "PerplexityBot", allow: ["/"] },
    { userAgent: "ClaudeBot", allow: ["/"] },
    { userAgent: "anthropic-ai", allow: ["/"] },
    { userAgent: "Googlebot", allow: ["/"] },
    { userAgent: "Bingbot", allow: ["/"] },
  ]);

  return new Response(robotsTxt, {
    headers: { "Content-Type": "text/plain" },
  });
}
