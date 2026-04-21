import { normalizeDomain } from "./isSameDomain";
import { Temporal } from "@js-temporal/polyfill";
import captureAndLogError from "./captureAndLogError.server";
import prisma from "~/lib/prisma.server";

type BotClass = "retrieval" | "search_indexing" | "training" | "other";

/**
 * Known bot patterns for classification
 *
 * Classes:
 * - retrieval: AI answering a user question about your site right now
 * - search_indexing: AI building an index for future answers
 * - training: AI training on your content
 * - other: Monitoring, testing, or other bots
 *
 * @see https://www.xseek.io/docs
 * @see https://plainsignal.com/agents/
 * @see https://surfacedby.com/blog/nginx-logs-ai-traffic-vs-referral-traffic
 */
const BOT_PATTERNS: {
  botClass: BotClass;
  pattern: RegExp;
  type: string;
}[] = [
  { botClass: "search_indexing", pattern: /ahrefsbot/i, type: "Ahrefs" },
  { botClass: "other", pattern: /amazonbot/i, type: "Amazon" },
  { botClass: "other", pattern: /anthropic-ai/i, type: "Claude AI" },
  { botClass: "search_indexing", pattern: /applebot/i, type: "Apple" },
  { botClass: "other", pattern: /archive\.org_bot/i, type: "Archive.org" },
  { botClass: "search_indexing", pattern: /baiduspider/i, type: "Baidu" },
  { botClass: "search_indexing", pattern: /bingbot/i, type: "Bing" },
  { botClass: "other", pattern: /bytespider/i, type: "ByteDance" },
  { botClass: "retrieval", pattern: /chatgpt-user/i, type: "ChatGPT User" },
  { botClass: "other", pattern: /chrome-lighthouse/i, type: "Lighthouse" },
  { botClass: "search_indexing", pattern: /claude-searchbot/i, type: "Claude Search" },
  { botClass: "retrieval", pattern: /claude-user/i, type: "Claude User" },
  { botClass: "training", pattern: /claudebot/i, type: "Claude Bot" },
  { botClass: "other", pattern: /curl/i, type: "cURL" },
  { botClass: "other", pattern: /discordbot/i, type: "Discord" },
  { botClass: "other", pattern: /dotbot/i, type: "DotBot" },
  { botClass: "search_indexing", pattern: /duckduckbot/i, type: "DuckDuck" },
  { botClass: "other", pattern: /ev-crawler/i, type: "Headline" },
  { botClass: "other", pattern: /exabot/i, type: "Exabot" },
  { botClass: "other", pattern: /facebookexternalhit/i, type: "Facebook" },
  { botClass: "other", pattern: /findfiles.net/i, type: "FindFiles" },
  { botClass: "search_indexing", pattern: /googlebot/i, type: "Google" },
  { botClass: "training", pattern: /gptbot/i, type: "GPT Bot" },
  { botClass: "other", pattern: /headlesschrome/i, type: "Headless Chrome" },
  { botClass: "other", pattern: /ia_archiver/i, type: "Alexa" },
  { botClass: "other", pattern: /lighthouse/i, type: "Lighthouse" },
  { botClass: "other", pattern: /linkedinbot/i, type: "LinkedIn" },
  { botClass: "retrieval", pattern: /manus-user/i, type: "Manus User" },
  { botClass: "training", pattern: /meta-externalagent/i, type: "Meta Agent" },
  { botClass: "retrieval", pattern: /meta-externalfetcher/i, type: "Meta Fetcher" },
  { botClass: "retrieval", pattern: /meta-webindexer/i, type: "Meta WebIndexer" },
  { botClass: "other", pattern: /mj12bot/i, type: "MajesticBot" },
  { botClass: "search_indexing", pattern: /oai-searchbot/i, type: "OpenAI Search" },
  { botClass: "retrieval", pattern: /perplexity-user/i, type: "Perplexity User" },
  { botClass: "search_indexing", pattern: /perplexitybot/i, type: "Perplexity Bot" },
  { botClass: "other", pattern: /phantomjs/i, type: "PhantomJS" },
  { botClass: "other", pattern: /pingdom/i, type: "Pingdom" },
  { botClass: "other", pattern: /python-requests/i, type: "Python Requests" },
  { botClass: "other", pattern: /rogerbot/i, type: "Rogerbot" },
  { botClass: "other", pattern: /rss-is-dead.lol/i, type: "RSS is Dead" },
  { botClass: "other", pattern: /saasbrowser.com/i, type: "SaaS Browser" },
  { botClass: "other", pattern: /scrapy/i, type: "Scrapy" },
  { botClass: "other", pattern: /selenium/i, type: "Selenium" },
  { botClass: "search_indexing", pattern: /semrushbot/i, type: "SEMrush" },
  { botClass: "other", pattern: /slackbot/i, type: "Slack" },
  { botClass: "search_indexing", pattern: /slurp/i, type: "Yahoo Slurp" },
  { botClass: "other", pattern: /telegrambot/i, type: "Telegram" },
  { botClass: "other", pattern: /twitterbot/i, type: "Twitter" },
  { botClass: "other", pattern: /uptimerobot/i, type: "UptimeRobot" },
  { botClass: "other", pattern: /webdriver/i, type: "WebDriver" },
  { botClass: "other", pattern: /wget/i, type: "wget" },
  { botClass: "other", pattern: /whatsapp/i, type: "WhatsApp" },
  { botClass: "search_indexing", pattern: /yandexbot/i, type: "Yandex" },
  { botClass: "search_indexing", pattern: /seranking/i, type: "SE Ranking" },
  { botClass: "other", pattern: /bot|crawl|spider|scrape/i, type: "Other Bot" },
];

interface BotClassification {
  botClass: BotClass;
  type: string;
}

/**
 * Classify a user agent as a bot.
 *
 * @param userAgent - The user agent.
 * @returns The bot classification, or `null` if it's not suspected to be a bot.
 */
export function classifyBot(userAgent: string): BotClassification | null {
  const match = BOT_PATTERNS.find(({ pattern }) => pattern.test(userAgent));
  if (!match) return null;
  return { botClass: match.botClass, type: match.type };
}

/**
 * Record a bot visit given explicit parameters.
 *
 * @param accept - The accept header.
 * @param ip - The IP address.
 * @param referer - The referer header.
 * @param url - The URL of the request.
 * @param userAgent - The user agent.
 * @returns A promise that resolves to the result of the bot visit.
 */
export default async function recordBotVisit({
  accept,
  ip,
  referer,
  site,
  url,
  userAgent,
}: {
  accept: string | null;
  ip: string | null;
  referer: string | null;
  site: { id: string };
  url: string;
  userAgent: string | null;
}): Promise<{ tracked: boolean; reason?: string }> {
  const { pathname } = new URL(url);
  if (!userAgent) return { tracked: false, reason: "no user agent" };
  const classification = classifyBot(userAgent);
  if (!classification) return { tracked: false, reason: "not a bot" };

  const date = new Date(
    Temporal.Now.zonedDateTimeISO("UTC").startOfDay().epochMilliseconds,
  );
  try {
    await prisma.botVisit.upsert({
      where: {
        date_siteId_userAgent_path: {
          date,
          path: pathname,
          siteId: site.id,
          userAgent,
        },
      },
      update: { count: { increment: 1 }, lastSeen: new Date() },
      create: {
        accept: parseAccept(accept),
        botClass: classification.botClass,
        botType: classification.type,
        count: 1,
        date,
        ip,
        path: pathname,
        referer: parseReferer(referer, new URL(url)),
        site: { connect: { id: site.id } },
        userAgent,
      },
    });
    return { tracked: true };
  } catch (error) {
    captureAndLogError(error, {
      extra: { botClass: classification.botClass, botType: classification.type, url, userAgent },
    });
    return { tracked: false, reason: "db error" };
  }
}

function parseAccept(acceptHeader?: string | null): string[] {
  if (!acceptHeader) return [];
  return acceptHeader
    .split(",")
    .map((t) => t.split(";")[0].trim())
    .filter(Boolean);
}

function parseReferer(referer: string | null, requestURL: URL): string | null {
  if (!referer) return null;
  try {
    const refererURL = new URL(referer);
    if (normalizeDomain(refererURL) === normalizeDomain(requestURL))
      return null;
  } catch {
    // ignore parse errors, keep referer as is
  }
  return referer;
}
