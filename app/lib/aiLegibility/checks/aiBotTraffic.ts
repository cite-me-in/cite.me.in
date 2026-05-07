import { shuffle } from "radashi";
import type { CheckResult } from "~/lib/aiLegibility/types";

const AI_BOTS = [
  {
    ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.1; +https://openai.com/gptbot",
    name: "GPTBot",
  },
  {
    ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/chatgpt-user",
    name: "ChatGPT-User",
  },
  {
    ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ClaudeBot/1.0; +https://claudebot.anthropic.com",
    name: "ClaudeBot",
  },
  {
    ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; Claude-Web/1.0; +https://claude.anthropic.com",
    name: "Claude-Web",
  },
  {
    ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; Google-Extended/1.0; +https://developers.google.com/",
    name: "Google-Extended",
  },
  {
    ua: "Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://docs.perplexity.ai/docs/perplexitybot)",
    name: "PerplexityBot",
  },
  {
    ua: "Mozilla/5.0 (compatible; Perplexity-User/1.0; +https://docs.perplexity.ai/docs/perplexitybot)",
    name: "Perplexity-User",
  },
];

const BLOCK_PATTERNS = [
  /access denied/i,
  /blocked/i,
  /security check/i,
  /captcha/i,
  /please wait.*verify/i,
  /you have been blocked/i,
  /automated access/i,
  /just a moment/i,
  /checking your browser/i,
  /attention required/i,
  /cloudflare/i,
];

type BotTestResult = {
  bot: string;
  page: string;
  blocked: boolean;
  status: number;
  statusText?: string;
  error?: string;
};

async function testBotAccess(
  bot: { ua: string; name: string },
  page: string,
): Promise<BotTestResult> {
  try {
    const response = await fetch(page, {
      headers: {
        "User-Agent": bot.ua,
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if ([403, 401, 429].includes(response.status)) {
      return {
        bot: bot.name,
        page,
        blocked: true,
        status: response.status,
        statusText: response.statusText,
      };
    }

    if (response.status === 200) {
      const content = await response.text();
      if (content.length < 500 && BLOCK_PATTERNS.some((p) => p.test(content))) {
        return {
          bot: bot.name,
          page,
          blocked: true,
          status: response.status,
          statusText: "WAF block page detected",
        };
      }
    }

    return { bot: bot.name, page, blocked: false, status: response.status };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return {
      bot: bot.name,
      page,
      blocked: false,
      status: 0,
      error: errorMessage,
    };
  }
}

export default async function checkAiBotTraffic({
  url,
  sampleUrls,
  log,
}: {
  url: string;
  sampleUrls?: string[];
  log: (line: string) => Promise<void> | void;
}): Promise<Omit<CheckResult, "category">> {
  const pagesToTest = shuffle([url, ...(sampleUrls ?? [])]).slice(0, 3);

  await log(`Checking AI bot traffic... (0/${AI_BOTS.length})`);

  const results: BotTestResult[] = [];
  for (let i = 0; i < AI_BOTS.length; i++) {
    const botResults = await Promise.all(
      pagesToTest.map((page) => testBotAccess(AI_BOTS[i], page)),
    );
    results.push(...botResults);
    await log(`Checking AI bot traffic... (${i + 1}/${AI_BOTS.length})`);
  }

  const blockedResults = results.filter((r) => r.blocked);

  if (blockedResults.length === 0) {
    return {
      name: "AI bot traffic",
      passed: true,
      message: `All ${AI_BOTS.length} AI bots can access the site`,
      details: {
        blockedResults: [],
        results,
        botsTested: AI_BOTS.length,
        pagesTested: pagesToTest,
      },
    };
  }

  const blockedByBot = new Map<string, number>();
  for (const r of blockedResults) {
    if (!blockedByBot.has(r.bot)) {
      blockedByBot.set(r.bot, r.status);
    }
  }

  const blockedSummary = Array.from(blockedByBot.entries())
    .map(([bot, status]) => `${bot} (${status})`)
    .join(", ");

  return {
    name: "AI bot traffic",
    passed: false,
    message: `${blockedByBot.size} bot${blockedByBot.size === 1 ? "" : "s"} blocked: ${blockedSummary}`,
    details: {
      blockedResults,
      results,
      botsTested: AI_BOTS.length,
      pagesTested: pagesToTest,
    },
  };
}
