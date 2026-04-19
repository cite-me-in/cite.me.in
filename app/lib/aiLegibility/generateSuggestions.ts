import OpenAI from "openai";
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
  log: (line: string) => Promise<void>;
  checks: CheckResult[];
  url: string;
}): Promise<Suggestion[]> {
  await log("Generating suggestions...");
  const failedChecks = checks.filter((c) => !c.passed);

  if (failedChecks.length === 0) return [];

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
- For SPA issues, explain server-side rendering or injection
- For MIME type issues, explain the correct Content-Type header

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
        description: `Create a plain-text file at ${url}/sitemap.txt with one URL per line listing all important pages on your site. This is the single most impactful change for AI discoverability.`,
        fixExample: `${url}/\n${url}/about\n${url}/products\n${url}/contact`,
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
