/**
 * Spec: RFC 9309 (Robots Exclusion Protocol)
 * Format: User-agent: <bot-name> / Disallow: <path> / Allow: <path>
 * Sitemap discovery: Sitemap: <url> (per sitemaps.org protocol)
 * AI bot detection checks known crawler user agents (GPTBot, ClaudeBot, etc.)
 */

import type { CheckResult } from "~/lib/aiLegibility/types";

const AI_BOT_USER_AGENTS = [
  { pattern: "gptbot", name: "GPTBot (OpenAI/ChatGPT)" },
  { pattern: "chatgpt-user", name: "ChatGPT-User" },
  { pattern: "oai-searchbot", name: "OAI-SearchBot (OpenAI)" },
  { pattern: "claudebot", name: "ClaudeBot (Anthropic/Claude)" },
  { pattern: "claude-web", name: "Claude-Web (Anthropic)" },
  { pattern: "google-extended", name: "Google-Extended (Google AI)" },
  { pattern: "bytespider", name: "Bytespider (ByteDance/TikTok AI)" },
  { pattern: "ccbot", name: "CCBot (Common Crawl)" },
  { pattern: "applebot-extended", name: "Applebot-Extended (Apple AI)" },
  { pattern: "perplexitybot", name: "PerplexityBot" },
  { pattern: "perplexity-user", name: "Perplexity-User" },
  { pattern: "cohere-ai", name: "Cohere-AI" },
  { pattern: "ai2bot", name: "AI2Bot (Allen AI)" },
  { pattern: "facebookbot", name: "FacebookBot (Meta)" },
  { pattern: "meta-externalagent", name: "Meta-ExternalAgent" },
  { pattern: "amazonbot", name: "Amazonbot" },
  { pattern: "duckduckbot", name: "DuckDuckBot" },
  { pattern: "yandex", name: "YandexBot" },
] as const;

function parseSitemapURLs(content: string): string[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^sitemap:/i.test(line))
    .map((line) => line.slice(line.indexOf(":") + 1).trim())
    .filter(Boolean);
}

function parseRobotsTxt(content: string) {
  const groups: { agents: string[]; rules: string[] }[] = [];
  let current: { agents: string[]; rules: string[] } | null = null;

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const agentMatch = trimmed.match(/^user-agent:\s*(.+)/i);
    if (agentMatch) {
      const agent = agentMatch[1].trim();
      if (!current || current.rules.length > 0) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(agent);
      continue;
    }

    const ruleMatch = trimmed.match(/^(allow|disallow):\s*(.*)/i);
    if (ruleMatch && current) current.rules.push(`${ruleMatch[1]}: ${ruleMatch[2].trim()}`);
  }

  return groups;
}

function findBlockedAiBots(content: string) {
  const groups = parseRobotsTxt(content);
  const blocked: { agent: string; displayName: string }[] = [];

  for (const bot of AI_BOT_USER_AGENTS) {
    const matchingGroups = groups.filter((g) =>
      g.agents.some((a) => a.toLowerCase().replace(/\s+/g, "-") === bot.pattern),
    );
    if (matchingGroups.length === 0) continue;

    const lastGroup = matchingGroups[matchingGroups.length - 1];
    const isFullyBlocked = lastGroup.rules.some((r) => /^disallow:\s*\/\s*$/i.test(r));
    if (!isFullyBlocked) continue;

    const hasAllow = lastGroup.rules.some((r) => /^allow:\s*\/\s*$/i.test(r));
    if (hasAllow) continue;

    blocked.push({
      agent: lastGroup.agents[0],
      displayName: bot.name,
    });
  }

  return blocked;
}

function generateRobotsFix(blockedBots: { agent: string; displayName: string }[]) {
  const lines = blockedBots.map(
    (b) =>
      `# ${b.displayName} — allow AI agents to read your content\nUser-agent: ${b.agent}\nAllow: /`,
  );
  return lines.join("\n\n");
}

export default async function checkRobotsTxt({
  url,
  robotsContent: externalContent,
}: {
  url: string;
  robotsContent?: string;
}): Promise<
  Omit<CheckResult, "category"> & {
    sitemapURLs?: string[];
  }
> {
  const robotsURL = new URL("/robots.txt", url).href;
  const startTime = Date.now();

  try {
    const content =
      externalContent ??
      (await (async () => {
        const response = await fetch(robotsURL, {
          headers: {
            "User-Agent": "CiteMeIn-AI-Legibility-Bot/1.0",
            Accept: "text/plain",
          },
          signal: AbortSignal.timeout(10_000),
        });
        return response.ok ? await response.text() : null;
      })());

    if (content === null) {
      return {
        name: "robots.txt",
        passed: false,
        message: `robots.txt not found (HTTP ${404})`,
        details: { statusCode: 404, url: robotsURL },
      };
    }

    const elapsed = Date.now() - startTime;

    const lines = content.split("\n").filter((line) => line.trim());
    const hasUserAgent = lines.some((line) => /user-agent/i.test(line));
    const hasAllowOrDisallow = lines.some((line) => /allow|disallow/i.test(line));
    const hasSitemap = lines.some((line) => /sitemap/i.test(line));
    const sitemapURLs = parseSitemapURLs(content);

    if (!hasUserAgent && !hasAllowOrDisallow) {
      return {
        name: "robots.txt",
        passed: true,
        message: "robots.txt exists but has no crawl rules",
        sitemapURLs,
        details: {
          url: robotsURL,
          lineCount: lines.length,
          hasSitemap,
          elapsed,
          robotsContent: content,
        },
      };
    }

    const blockedAiBots = findBlockedAiBots(content);
    if (blockedAiBots.length > 0) {
      const botNames = blockedAiBots.map((b) => b.displayName).join(", ");
      return {
        name: "robots.txt",
        passed: false,
        message: `robots.txt blocks AI bots: ${botNames}`,
        sitemapURLs,
        details: {
          url: robotsURL,
          lineCount: lines.length,
          hasSitemap,
          elapsed,
          blockedAiBots,
          suggestedFix: generateRobotsFix(blockedAiBots),
          robotsContent: content,
        },
      };
    }

    return {
      name: "robots.txt",
      passed: true,
      message: `robots.txt found with ${lines.length} lines${hasSitemap ? " (includes sitemap reference)" : ""}`,
      sitemapURLs,
      details: {
        url: robotsURL,
        lineCount: lines.length,
        hasSitemap,
        elapsed,
        robotsContent: content,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    if (error instanceof Error && error.name === "TimeoutError") {
      return {
        name: "robots.txt",
        passed: false,
        message: "robots.txt request timed out (10s limit)",
        timedOut: true,
        details: { url: robotsURL },
      };
    }
    return {
      name: "robots.txt",
      passed: false,
      message: `Failed to fetch robots.txt: ${errorMessage}`,
      details: { url: robotsURL, error: errorMessage },
    };
  }
}
