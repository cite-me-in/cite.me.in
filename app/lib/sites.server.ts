import { Temporal } from "@js-temporal/polyfill";
import { ms } from "convert";
import debug from "debug";
import { groupBy, sortBy, sumBy, uniqBy } from "es-toolkit";
import { generateApiKey } from "random-password-toolkit";
import parseHTMLTree, {
  getElementsByTagName,
  getMainContent,
  htmlToMarkdown,
} from "~/lib/html/parseHTML";
import type { Site } from "~/prisma";
import calculateVisibilityScore from "./llm-visibility/calculateVisibilityScore";
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

  const content = await fetchSiteContent({
    domain,
    maxPages: 10,
    maxWords: 5_000,
  });
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
 * Fetch the page content for a given domain. Crawls up to maxPages pages
 * (homepage + additional pages discovered via sitemap.xml or nav links),
 * converts HTML to Markdown, and returns the combined text up to maxWords
 * words.
 */
export async function fetchSiteContent({
  domain,
  maxPages,
  maxWords,
}: {
  domain: string;
  maxPages: number;
  maxWords: number;
}): Promise<string> {
  try {
    return await crawlSiteCustom({ domain, maxPages, maxWords });
  } catch (error) {
    if (error instanceof Response) throw error;
    throw new Error(`I couldn't fetch the main page of ${domain}`);
  }
}

const MEDIA_EXTENSIONS = /\.(pdf|jpg|jpeg|png|gif|svg|webp|mp4|mp3|zip|exe)$/i;

async function crawlSiteCustom({
  domain,
  maxPages,
  maxWords,
}: {
  domain: string;
  maxPages: number;
  maxWords: number;
}): Promise<string> {
  logger("Crawling %s", domain);

  // Step 1: fetch homepage
  const homepageRes = await fetch(`https://${domain}/`, {
    signal: AbortSignal.timeout(ms("5s")),
    redirect: "follow",
  });
  if (!homepageRes.ok)
    throw new Error(
      `HTTP ${homepageRes.status} fetching ${domain}: ${await homepageRes.text()}`,
    );
  const homepageHtml = await homepageRes.text();
  const homepageTree = parseHTMLTree(homepageHtml);

  // Step 2: discover additional URLs (up to 10)
  const additionalUrls = await discoverUrls({
    domain,
    maxPages: maxPages - 1,
    tree: homepageTree,
  });

  // Step 3: fetch additional pages concurrently
  const additionalHtmls = await Promise.all(
    additionalUrls.map(async (url) => {
      try {
        const res = await fetch(url, {
          signal: AbortSignal.timeout(ms("5s")),
          redirect: "follow",
        });
        if (!res.ok) return null;
        return { url, html: await res.text() };
      } catch {
        return null;
      }
    }),
  );

  // Step 4: convert each page to markdown
  const pages = [
    { url: `https://${domain}/`, html: homepageHtml },
    ...additionalHtmls.filter((p) => p !== null),
  ];

  const markdowns = pages.map(({ url, html }) => {
    const tree = parseHTMLTree(html);
    const content = getMainContent(tree);
    const md = htmlToMarkdown(content);

    const titleNodes = getElementsByTagName(tree, "title");
    const title =
      titleNodes[0]?.children
        .filter((n) => n.type === "text")
        .map((n) => (n.type === "text" ? n.content : ""))
        .join("") ?? new URL(url).pathname;

    return `## ${title}\n\n${md}`;
  });

  // Step 5: combine and limit
  const combined = markdowns.join("\n\n---\n\n");
  const words = combined.split(/\s+/);
  console.log("Crawled %s pages => %s words", pages.length, words.length);
  logger("Crawled %s pages => %s words", pages.length, words.length);
  return words.slice(0, maxWords).join(" ");
}

async function discoverUrls({
  domain,
  maxPages,
  tree,
}: {
  domain: string;
  maxPages: number;
  tree: ReturnType<typeof parseHTMLTree>;
}): Promise<string[]> {
  const sitemapUrls = await fetchSitemapUrls(domain);
  if (sitemapUrls.length >= maxPages) return sitemapUrls.slice(0, maxPages);

  const navUrls = extractNavUrls({ domain, tree });
  const combined = [
    ...sitemapUrls,
    ...navUrls.filter((u) => !sitemapUrls.includes(u)),
  ];
  return combined.slice(0, maxPages);
}

async function fetchSitemapUrls(domain: string): Promise<string[]> {
  try {
    const res = await fetch(`https://${domain}/sitemap.xml`, {
      signal: AbortSignal.timeout(ms("3s")),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const locs: string[] = [];
    const locRegex = /<loc>(.*?)<\/loc>/g;
    for (
      let match = locRegex.exec(xml);
      match !== null;
      match = locRegex.exec(xml)
    ) {
      const url = match[1]?.trim();
      if (!url) continue;
      try {
        const parsed = new URL(url);
        if (parsed.hostname !== domain) continue;
        if (parsed.pathname === "/" || parsed.pathname === "") continue;
        if (MEDIA_EXTENSIONS.test(parsed.pathname)) continue;
        locs.push(url);
      } catch {
        // ignore malformed URLs
      }
    }
    return locs.slice(0, 4);
  } catch {
    return [];
  }
}

function extractNavUrls({
  domain,
  tree,
}: {
  domain: string;
  tree: ReturnType<typeof parseHTMLTree>;
}): string[] {
  const navs = getElementsByTagName(tree, "nav");
  const anchors =
    navs.length > 0
      ? navs.flatMap((nav) => getElementsByTagName(nav.children, "a"))
      : getElementsByTagName(tree, "a");

  const seen = new Set<string>();
  const urls: string[] = [];

  for (const anchor of anchors) {
    const href = anchor.attributes.href;
    if (!href || href.startsWith("#") || href.startsWith("mailto:")) continue;
    if (MEDIA_EXTENSIONS.test(href)) continue;

    let url: URL;
    try {
      url = new URL(
        href.startsWith("http") ? href : `https://${domain}${href}`,
      );
    } catch {
      continue;
    }

    if (url.hostname !== domain) continue;
    if (url.pathname === "/" || url.pathname === "") continue;
    const depth = url.pathname.split("/").filter(Boolean).length;
    if (depth > 3) continue;

    const key = url.origin + url.pathname;
    if (seen.has(key)) continue;
    seen.add(key);
    urls.push(url.href);
  }

  return urls;
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

if (import.meta.main) {
  const content = await fetchSiteContent({
    domain: "cite.me.in",
    maxPages: 10,
    maxWords: 5_000,
  });
  console.log(content);
}
