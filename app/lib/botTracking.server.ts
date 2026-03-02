import { Temporal } from "@js-temporal/polyfill";
import { captureException } from "@sentry/react-router";
import prisma from "~/lib/prisma.server";

/**
 * Known bot patterns for classification
 *
 * @see https://www.xseek.io/docs
 * @see https://plainsignal.com/agents/
 */
const BOT_PATTERNS = [
  { pattern: /ahrefsbot/i, type: "Ahrefs" },
  { pattern: /amazonbot/i, type: "Amazon" },
  { pattern: /anthropic-ai/i, type: "Claude AI" },
  { pattern: /applebot/i, type: "Apple" },
  { pattern: /archive\.org_bot/i, type: "Archive.org" },
  { pattern: /baiduspider/i, type: "Baidu" },
  { pattern: /bingbot/i, type: "Bing" },
  { pattern: /bytespider/i, type: "ByteDance" },
  { pattern: /chrome-lighthouse/i, type: "Lighthouse" },
  { pattern: /claude-searchbot/i, type: "Claude Search" },
  { pattern: /claude-user/i, type: "Claude User" },
  { pattern: /claudebot/i, type: "Claude Bot" },
  { pattern: /curl/i, type: "cURL" },
  { pattern: /discordbot/i, type: "Discord" },
  { pattern: /dotbot/i, type: "DotBot" },
  { pattern: /duckduckbot/i, type: "DuckDuck" },
  { pattern: /ev-crawler/i, type: "Headline" },
  { pattern: /exabot/i, type: "Exabot" },
  { pattern: /facebookexternalhit/i, type: "Facebook" },
  { pattern: /findfiles.net/i, type: "FindFiles" },
  { pattern: /googlebot/i, type: "Google" },
  { pattern: /gptbot|chatgpt-user/i, type: "ChatGPT" },
  { pattern: /headlesschrome/i, type: "Headless Chrome" },
  { pattern: /ia_archiver/i, type: "Alexa" },
  { pattern: /lighthouse/i, type: "Lighthouse" },
  { pattern: /linkedinbot/i, type: "LinkedIn" },
  { pattern: /meta-externalagent/i, type: "Meta" },
  { pattern: /mj12bot/i, type: "MajesticBot" },
  { pattern: /oai-searchbot/i, type: "OpenAI Search" },
  { pattern: /perplexitybot/i, type: "Perplexity" },
  { pattern: /phantomjs/i, type: "PhantomJS" },
  { pattern: /pingdom/i, type: "Pingdom" },
  { pattern: /python-requests/i, type: "Python Requests" },
  { pattern: /rogerbot/i, type: "Rogerbot" },
  { pattern: /rss-is-dead.lol/i, type: "RSS is Dead" },
  { pattern: /saasbrowser.com/i, type: "SaaS Browser" },
  { pattern: /scrapy/i, type: "Scrapy" },
  { pattern: /selenium/i, type: "Selenium" },
  { pattern: /semrushbot/i, type: "SEMrush" },
  { pattern: /slackbot/i, type: "Slack" },
  { pattern: /slurp/i, type: "Yahoo Slurp" },
  { pattern: /telegrambot/i, type: "Telegram" },
  { pattern: /twitterbot/i, type: "Twitter" },
  { pattern: /uptimerobot/i, type: "UptimeRobot" },
  { pattern: /webdriver/i, type: "WebDriver" },
  { pattern: /wget/i, type: "wget" },
  { pattern: /whatsapp/i, type: "WhatsApp" },
  { pattern: /yandexbot/i, type: "Yandex" },
  { pattern: /seranking/i, type: "SE Ranking" },
  { pattern: /bot|crawl|spider|scrape/i, type: "Other Bot" },
] as const;

function classifyBot(userAgent: string): string | null {
  return (
    BOT_PATTERNS.find(({ pattern }) => pattern.test(userAgent))?.type ?? null
  );
}

/**
 * Record a bot visit given explicit parameters.
 * Used by both the middleware tracker and the external API endpoint.
 */
export async function recordBotVisit({
  url,
  userAgent,
  accept,
  ip,
  referer,
}: {
  url: string;
  userAgent: string;
  accept: string | null;
  ip: string | null;
  referer: string | null;
}): Promise<{ tracked: boolean; reason?: string }> {
  const botType = classifyBot(userAgent);
  if (!botType) return { tracked: false, reason: "not a bot" };
  if (/Better Stack/i.test(userAgent))
    return { tracked: false, reason: "excluded" };

  const { hostname, pathname } = new URL(url);
  const domain = hostname.toLowerCase();
  const site = await prisma.site.findFirst({ where: { domain } });
  if (!site) return { tracked: false, reason: "site not found" };

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
        botType,
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
    captureException(error, {
      extra: { botType, domain, pathname, userAgent },
    });
    return { tracked: false, reason: "db error" };
  }
}

/**
 * Track a bot visit from an incoming request (middleware usage).
 */
export async function trackBotVisit(request: Request): Promise<void> {
  const userAgent = request.headers.get("user-agent");
  if (!userAgent) return;

  const url = request.url;
  const accept = request.headers.get("accept");
  const ip = request.headers.get("x-real-ip");
  const referer = request.headers.get("referer");

  await recordBotVisit({ url, userAgent, accept, ip, referer });
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
    if (refererURL.hostname.toLowerCase() === requestURL.hostname.toLowerCase())
      return null;
  } catch {
    // ignore parse errors, keep referer as is
  }
  return referer;
}
