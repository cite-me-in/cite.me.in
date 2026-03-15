import { Temporal } from "@js-temporal/polyfill";
import { ms } from "convert";
import debug from "debug";
import { delay, groupBy, sortBy, sumBy, uniqBy } from "es-toolkit";
import { generateApiKey } from "random-password-toolkit";
import parseHTMLTree, { getBodyContent } from "~/lib/html/parseHTML";
import type { Site } from "~/prisma";
import envVars from "./envVars";
import calculateVisibilityScore from "./llm-visibility/calculateVisibilityScore";
import logError from "./logError.server";
import prisma from "./prisma.server";

const logger = debug("fetch");

export async function addSiteToUser(
  user: { id: string },
  url: string,
): Promise<{
  site: Site;
  existing: boolean;
}> {
  const domain = extractDomain(url);
  if (!domain) throw new Error("Enter a valid website URL or domain name");

  const existing = await prisma.site.findFirst({
    where: { ownerId: user.id, domain },
  });
  if (existing) return { site: existing, existing: true };

  const content = await fetchSiteContent({ domain, maxWords: 5_000 });
  const site = await prisma.site.create({
    data: {
      owner: { connect: { id: user.id } },
      apiKey: `cite.me.in_${generateApiKey(16)}`,
      content,
      domain,
    },
  });
  return { site, existing: false };
}

/**
 * Extract the domain from a URL.
 *
 * @param url - The URL to extract the domain from.
 * @returns The domain, or null if the URL is not valid.
 */
export function extractDomain(url: string): string | null {
  try {
    const href = url.startsWith("http") ? url : `https://${url}`;
    const { hostname } = new URL(href);
    if (!hostname || hostname === "localhost") return null;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return null;
    return hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Fetch the page content for a given domain. If the page is not found or the
 * request times out, throws an error. Starts using Cloudflare's API to crawl 5
 * pages and return the markdown content, up to maxWords words. If that fails,
 * falls back to fetching one page content directly.
 *
 * @param domain - The domain to fetch the page content for.
 * @param maxWords - The maximum number of words to return from the page content.
 * @returns The page content, up to maxWords words.
 * @throws {Error} If the page is not found or the request times out, or if the
 * page content cannot be fetched using Cloudflare's API or directly.
 */
export async function fetchSiteContent({
  domain,
  maxWords,
}: {
  domain: string;
  maxWords: number;
}): Promise<string> {
  try {
    const content = await crawlSite({ domain, maxWords });
    if (content) return content;
  } catch (error) {
    logError(error, { extra: { domain } });
    logger("Failed to crawl %s: %s", domain, error);
  }

  try {
    const content = await fetchPage({ domain, maxWords });
    if (content) return content;
  } catch (error) {
    logError(error, { extra: { domain } });
    throw new Error(`I couldn't fetch the main page of ${domain}`);
  }

  throw new Error(
    `I couldn't fetch ${domain} — is the site live and accessible?`,
  );
}

/**
 * Fetch the page content for a given domain directly. If the page is not found
 * or the request times out, throws an error.
 */
async function fetchPage({
  domain,
  maxWords,
}: {
  domain: string;
  maxWords: number;
}): Promise<string | null> {
  const response = await fetch(`https://${domain}/`, {
    signal: AbortSignal.timeout(ms("5s")),
    redirect: "follow",
  });
  if (!response.ok)
    throw new Error(
      `HTTP error! status: ${response.status} ${await response.text()}`,
    );
  const html = await response.text();
  const tree = parseHTMLTree(html);
  const content = getBodyContent(tree).slice(0, 5_000);
  const words = content.split(/\s+/);
  logger("Fetched %s ch => %s words", content.length, words.length);
  return words.slice(0, maxWords).join(" ");
}

/**
 * Crawl the site using Cloudflare's API. This will crawl up to 5 pages per site,
 * and return the markdown content of the pages, up to maxWords words.
 *
 * @param domain - The domain to crawl.
 * @param maxWords - The maximum number of words to return.
 * @returns The markdown content of the pages, up to maxWords words.
 */
async function crawlSite({
  domain,
  maxWords,
}: {
  domain: string;
  maxWords: number;
}): Promise<string | null> {
  logger("Crawling %s", domain);
  const crawlId = await startCrawl({ limit: 5, url: domain });
  const records = await pollCrawl(crawlId);

  const markdown = records.map(({ markdown }) => markdown).join("\n");
  const words = markdown.split(/\s+/);
  logger("Crawled %s ch => %s words", markdown.length, words.length);

  return words.slice(0, maxWords).join(" ");
}

/**
 * Start a crawl using Cloudflare's API.
 *
 * @param url - The URL to crawl.
 * @param limit - The number of pages to crawl.
 * @returns The crawl ID, @see pollCrawl
 */
async function startCrawl({
  limit,
  url,
}: {
  limit: number;
  url: string;
}): Promise<string> {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${envVars.CLOUDFLARE_ACCOUNT_ID}/browser-rendering/crawl`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${envVars.CLOUDFLARE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        depth: 2,
        formats: ["markdown"],
        limit,
        render: false,
        source: "all",
        url,
      }),
    },
  );
  if (!response.ok)
    throw new Error(
      `HTTP error! status: ${response.status}: ${await response.text()}`,
    );
  const { success, result } = (await response.json()) as {
    success: boolean;
    result: string;
  };
  if (!success) throw new Error(`Failed to crawl ${url}`);
  return result;
}

/**
 * Poll a crawl using Cloudflare's API. Polls until the crawl is completed or
 * fails.
 *
 * @param crawlId - The ID of the crawl to poll.
 * @returns The records of the crawl, @see startCrawl
 */
async function pollCrawl(crawlId: string): Promise<
  {
    url: string;
    status: string;
    metadata: {
      lastModified: string;
      status: number;
      title: string;
      url: string;
    };
    markdown: string;
  }[]
> {
  for (let i = 0; i < 100; i++) {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${envVars.CLOUDFLARE_ACCOUNT_ID}/browser-rendering/crawl/${crawlId}`,
      { headers: { Authorization: `Bearer ${envVars.CLOUDFLARE_API_KEY}` } },
    );
    if (!response.ok)
      throw new Error(
        `HTTP error! status: ${response.status} ${await response.text()}`,
      );
    const { result, success } = (await response.json()) as {
      success: boolean;
      result: {
        id: string;
        status: string;
        records: {
          url: string;
          status: string;
          metadata: {
            lastModified: string;
            status: number;
            title: string;
            url: string;
          };
          markdown: string;
        }[];
      };
    };
    if (!success) throw new Error(`Failed to poll crawl ${crawlId}`);
    if (result.status === "completed") return result.records;
    if (result.status !== "running")
      throw new Error(`Failed to crawl ${crawlId}: ${result.status}`);
    await delay(ms("1s"));
  }
  throw new Error(`Failed to crawl: ${crawlId}`);
}

export async function loadSitesWithMetrics(userId: string): Promise<
  {
    citationsToDomain: number;
    previousCitationsToDomain: number | null;
    previousScore: number | null;
    score: number;
    site: Site;
    totalBotVisits: number;
    totalCitations: number;
    uniqueBots: number;
    isOwner: boolean;
  }[]
> {
  const gte = new Date(
    Temporal.Now.plainDateISO().subtract({ days: 14 }).toJSON(),
  );
  const sites = await prisma.site.findMany({
    include: {
      citationRuns: {
        select: {
          createdAt: true,
          queries: {
            select: { citations: true, position: true, text: true },
          },
        },
        orderBy: { createdAt: "desc" },
        where: { createdAt: { gte } },
      },
      botVisits: {
        select: { count: true, botType: true },
        where: { date: { gte } },
      },
    },
    orderBy: [{ domain: "asc" }, { createdAt: "desc" }],
    where: {
      OR: [{ ownerId: userId }, { siteUsers: { some: { userId } } }],
    },
  });

  return sites.map((site) => {
    // Group all runs by date, so each date has all the platform runs for that date:
    // { "2026-03-12": runs, "2026-03-11": runs, ... }
    const byDate = groupBy(site.citationRuns, ({ createdAt }) =>
      createdAt.toISOString().slice(0, 10),
    );

    // Sort the dates in reverse chronological order, most recent is first:
    // [{ date: "2026-03-12", queries }, { date: "2026-03-11", queries }, ...]
    const chronological = sortBy(Object.entries(byDate), [([date]) => date])
      .reverse()
      .flatMap(([date, runs]) => ({
        date,
        queries: runs.flatMap(({ queries }) => queries),
      }));

    // Compute composite visibility score for the most recent date's queries
    const current = calculateVisibilityScore({
      domain: site.domain,
      queries: chronological[0]?.queries ?? [],
    });
    // Compute for the second most recent date for delta comparison
    const previous = chronological[1]
      ? calculateVisibilityScore({
          domain: site.domain,
          queries: chronological[1].queries,
        })
      : null;

    return {
      citationsToDomain: current.domainCitations,
      previousCitationsToDomain: previous?.domainCitations ?? null,
      previousScore: previous?.visibilityScore ?? null,
      score: current.visibilityScore,
      site,
      totalBotVisits: sumBy(site.botVisits, (v) => v.count),
      totalCitations: current.totalCitations,
      uniqueBots: uniqBy(site.botVisits, (v) => v.botType).length,
      isOwner: site.ownerId === userId,
    };
  });
}

export async function requireSiteAccess(
  domain: string,
  userId: string,
): Promise<Site> {
  const site = await prisma.site.findFirst({
    where: {
      domain,
      OR: [{ ownerId: userId }, { siteUsers: { some: { userId } } }],
    },
  });
  if (!site) throw new Response("Not found", { status: 404 });
  return site;
}

export async function requireSiteOwner(
  domain: string,
  userId: string,
): Promise<Site> {
  const site = await prisma.site.findFirst({
    where: { domain, ownerId: userId },
  });
  if (!site) throw new Response("Forbidden", { status: 403 });
  return site;
}

export async function deleteSite({
  userId,
  siteId,
}: {
  userId: string;
  siteId: string;
}): Promise<void> {
  const site = await prisma.site.findFirst({
    where: { id: siteId, ownerId: userId },
  });
  if (site) await prisma.site.delete({ where: { id: siteId } });
}
