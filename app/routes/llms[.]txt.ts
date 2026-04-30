import envVars from "~/lib/envVars.server";

const appUrl = envVars.VITE_APP_URL;

export async function loader() {
  const lines = [
    "# cite.me.in",
    "> Monitor when ChatGPT, Claude, Gemini, and Perplexity cite your website in their answers.",
    "",
    "## Key pages",
    `- Homepage: ${appUrl}/`,
    `- Try it: ${appUrl}/try — Free 11-check AI legibility scan for any website`,
    `- Pricing: ${appUrl}/pricing`,
    `- FAQ: ${appUrl}/faq`,
    `- API Docs: ${appUrl}/docs`,
    "",
    "## About",
    `- About: ${appUrl}/about`,
    "- Blog: https://blog.cite.me.in/",
    "",
    "## Legal",
    `- Terms: ${appUrl}/terms`,
    `- Privacy: ${appUrl}/privacy`,
  ];

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
