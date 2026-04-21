import { ms } from "convert";
import OpenAI from "openai";
import { sleep } from "radashi";
import { z } from "zod";
import envVars from "~/lib/envVars.server";
import type { CheckResult, Suggestion } from "./types";

const suggestionSchema = z.object({
  title: z.string(),
  category: z.enum(["critical", "important", "optimization"]),
  effort: z.enum(["2 min", "5 min", "15 min", "1 hour"]),
  description: z.string(),
  fixExample: z.string().optional(),
});

const responseSchema = z.object({
  suggestions: z.array(suggestionSchema),
});

const client = new OpenAI({
  apiKey: envVars.ZHIPU_API_KEY,
  baseURL: "https://api.z.ai/api/paas/v4/",
  fetch: process.env.NODE_ENV === "test" ? global.fetch : undefined,
});

export default async function generateSuggestions({
  log,
  checks,
  url,
}: {
  log: (line: string) => Promise<unknown> | unknown;
  checks: CheckResult[];
  url: string;
}): Promise<Suggestion[]> {
  await log("Generating suggestions...");
  const failedChecks = checks.filter((c) => !c.passed);

  if (failedChecks.length === 0) return [];

  // Log messages to keep the user informed - in backgroung and terminated when we're done
  const abort = new AbortController();
  logInBackground({ log, signal: abort.signal });

  const checkSummaries = failedChecks.map((c) => ({
    name: c.name,
    category: c.category,
    message: c.message,
    details: c.details,
    timedOut: c.timedOut,
  }));

  const completion = await client.chat.completions.create({
    model: "glm-4.7",
    messages: [
      {
        role: "system",
        content: `You are an AI legibility expert. Given failed checks from a website scan, generate contextual suggestions for fixing each issue.

For each failed check, provide:
1. A clear title for the fix
2. The category (critical/important/optimization - use same as the check)
3. Estimated effort (2 min, 5 min, 15 min, or 1 hour)
4. A detailed description with the specific URL mentioned
5. Optionally, a code example or URL pattern to help fix the issue

Guidelines:
- Be specific about the URL (use ${url})
- Provide actionable, concrete steps
- Mention specific file paths when relevant (e.g., /sitemap.txt, /robots.txt)
- For sitemap suggestions, show all three delivery methods: robots.txt Sitemap directive, HTML <link rel="sitemap"> tag, and HTTP Link header
- For SPA issues, explain server-side rendering or injection
- For MIME type issues, explain the correct Content-Type header
- Write suggestions in a manner that any LLM can understand and use to fix the issue.

Respond with JSON only:
{
  "suggestions": [
    {
      "title": "...",
      "category": "critical"|"important"|"optimization",
      "effort": "2 min"|"5 min"|"15 min"|"1 hour",
      "description": "...",
      "fixExample": "..."
    }
  ]
}`,
      },
      {
        role: "user",
        content: `Website: ${url}

Failed checks:
${JSON.stringify(checkSummaries, null, 2)}

Generate suggestions for each failed check.`,
      },
    ],
    response_format: { type: "json_object" },
  });

  try {
    const raw = completion.choices[0].message.content ?? "{}";
    const json = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
    const parsed = JSON.parse(json);
    const result = responseSchema.parse(parsed);

    await log(`✓ ${result.suggestions.length} suggestions generated`);
    return result.suggestions.map((s) => ({
      title: s.title,
      category: s.category,
      effort: s.effort,
      description: s.description,
      fixExample: s.fixExample,
    }));
  } catch (error) {
    const message = `Suggestion generation parse error: ${error instanceof Error ? error.message : "Unknown error"}`;
    await log(`✗ ${message}`);
    return generateFallbackSuggestions(failedChecks, url);
  } finally {
    abort.abort();
  }
}

function generateFallbackSuggestions(
  failedChecks: CheckResult[],
  url: string,
): Suggestion[] {
  return failedChecks.map((check) => {
    const base: Suggestion = {
      title: `Fix: ${check.name}`,
      category: check.category,
      effort: check.category === "critical" ? "15 min" : "5 min",
      description: check.message,
    };

    if (check.name === "sitemap.txt") {
      return {
        ...base,
        title: "Add sitemap.txt",
        effort: "5 min",
        description: `Create a plain-text file at ${url}/sitemap.txt with one URL per line listing all important pages on your site. This is the single most impactful change for AI discoverability. Make it discoverable by referencing it from robots.txt, your HTML, or HTTP headers.`,
        fixExample: `# 1. robots.txt — add a Sitemap line:\nSitemap: ${url}/sitemap.txt\n\n# 2. HTML <head> — add a link tag:\n<link rel="sitemap" type="text/plain" title="Sitemap" href="/sitemap.txt">\n\n# 3. HTTP header — add a Link header:\nLink: </sitemap.txt>; rel=sitemap; type=text/plain\n\n# sitemap.txt content:\n${url}/\n${url}/about\n${url}/products\n${url}/contact`,
      };
    }

    if (check.name === "sitemap.xml") {
      return {
        ...base,
        title: "Add sitemap.xml",
        effort: "5 min",
        description: `Create an XML sitemap at ${url}/sitemap.xml listing all important pages using the sitemaps.org protocol. Make it discoverable by referencing it from robots.txt, your HTML, or HTTP headers.`,
        fixExample: `# 1. robots.txt — add a Sitemap line:\nSitemap: ${url}/sitemap.xml\n\n# 2. HTTP header — add a Link header:\nLink: </sitemap.xml>; rel=sitemap; type=application/xml\n\n# sitemap.xml content:\n<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${url}/</loc></url>\n  <url><loc>${url}/about</loc></url>\n  <url><loc>${url}/products</loc></url>\n</urlset>`,
      };
    }

    if (check.name === "Homepage content") {
      return {
        ...base,
        title: "Add server-side content to homepage",
        effort: "1 hour",
        description: `Your homepage at ${url} appears to be an empty SPA shell. AI agents don't execute JavaScript. Add server-side rendering or inject a hidden navigation block with your main content links into the HTML response.`,
      };
    }

    if (check.name === "robots.txt" && check.details?.blockedAiBots) {
      const blockedList = (
        check.details.blockedAiBots as { displayName: string }[]
      )
        .map((b) => b.displayName)
        .join(", ");
      return {
        ...base,
        title: "Unblock AI bots in robots.txt",
        effort: "2 min",
        description: `Your robots.txt blocks the following AI crawlers: ${blockedList}. This prevents AI tools like ChatGPT, Claude, and Gemini from reading and citing your content. Remove or change the Disallow: / rules for these user-agents to Allow: /.`,
        fixExample:
          (check.details.suggestedFix as string) ??
          "# Replace Disallow: / with Allow: /\nUser-agent: GPTBot\nAllow: /",
      };
    }

    if (check.name === "JSON-LD") {
      return {
        ...base,
        title: "Add JSON-LD structured data",
        effort: "15 min",
        description: `Add a <script type="application/ld+json"> block to your pages with schema.org structured data (Article, Organization, WebSite, etc.) to help AI agents understand your content.`,
      };
    }

    return base;
  });
}

/**
 * Log messages in background and terminate when the abort signal is triggered.
 * We use this to keep the user informed about the progress so they don't think
 * the scan is stuck.
 *
 * @param {Function} log - The function to log the message
 * @param {AbortSignal} signal - The abort signal
 */
async function logInBackground({
  log,
  signal,
}: {
  log: (line: string) => Promise<unknown> | unknown;
  signal: AbortSignal;
}) {
  const messages = [
    "We're consulting the AI to generate suggestions...",
    "This will take a few minutes...",
    "Please wait. This is normal...",
    "We will send you an email with the suggestions once we're done...",
  ];

  for (const message of messages) {
    await sleep(ms("5s"));
    if (signal.aborted) return;
    await log(message);
  }
}
