import { Temporal } from "@js-temporal/polyfill";
import { groupBy, sortBy, sumBy, uniqBy } from "es-toolkit";
import { generateApiKey } from "random-password-toolkit";
import type { Site } from "~/prisma";
import calculateVisibilityScore from "./llm-visibility/calculateVisibilityScore";
import prisma from "./prisma.server";
import { crawl } from "./scrape/crawl";

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

  const account = await prisma.account.findUnique({
    where: { userId: user.id },
    select: { status: true },
  });
  const isPro = account?.status === "active";
  const limit = isPro ? 5 : 1;

  const siteCount = await prisma.site.count({ where: { ownerId: user.id } });
  if (siteCount >= limit) {
    const limitMsg = isPro
      ? "Pro plan supports up to 5 sites. Contact us if you need more."
      : "Free trial supports 1 site. Upgrade to Pro to add up to 5 sites.";
    throw new Error(limitMsg);
  }

  const content = await crawl({
    baseURL: url,
    maxPages: 10,
    maxWords: 5_000,
    maxSeconds: 15,
  });
  const site = await prisma.site.create({
    data: {
      owner: { connect: { id: user.id } },
      apiKey: `cite.me.in_${generateApiKey(16)}`,
      content,
      domain: new URL(url).hostname,
    },
  });
  return { site, existing: false };
}

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
          onDate: true,
          queries: {
            select: { citations: true, position: true, text: true },
          },
        },
        orderBy: { onDate: "desc" },
        where: { onDate: { gte: gte.toISOString() } },
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
    const byDate = groupBy(site.citationRuns, ({ onDate }) => onDate);

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
