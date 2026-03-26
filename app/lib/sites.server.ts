import { Temporal } from "@js-temporal/polyfill";
import { partition, sumBy } from "es-toolkit";
import { generateApiKey } from "random-password-toolkit";
import type { Site } from "~/prisma";
import calculateVisibilityScore from "./llm-visibility/calculateVisibilityScore";
import prisma from "./prisma.server";
import { crawl } from "./scrape/crawl";
import { summarize } from "./scrape/summarize";

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
    domain,
    maxPages: 10,
    maxWords: 5_000,
    maxSeconds: 15,
  });
  const summary = await summarize({ domain, content });

  const site = await prisma.site.create({
    data: {
      apiKey: `cite.me.in_${generateApiKey(16)}`,
      content,
      domain,
      owner: { connect: { id: user.id } },
      summary,
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
    site: Site;
    isOwner: boolean;

    // Total citations for the current and previous week
    allCitations: {
      current: number;
      previous: number;
    };
    // Your citations only for the current and previous week
    yourCitations: {
      current: number;
      previous: number;
    };
    // Visibility score for the current and previous week
    visbilityScore: {
      current: number;
      previous: number;
    };
    // Unique bot visits for the current and previous week
    botVisits: { current: number; previous: number };
  }[]
> {
  const weekStart = Temporal.Now.plainDateISO("UTC").subtract({ days: 7 });
  const prevWeekStart = weekStart.subtract({ days: 7 });

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
        where: { onDate: { gte: prevWeekStart.toJSON() } },
      },
    },
    orderBy: [{ domain: "asc" }, { createdAt: "desc" }],
    where: {
      OR: [{ ownerId: userId }, { siteUsers: { some: { userId } } }],
    },
  });

  const queries = await prisma.citationQuery.findMany({
    select: {
      citations: true,
      position: true,
      text: true,
      createdAt: true,
      run: {
        select: {
          onDate: true,
          siteId: true,
        },
      },
    },
    where: {
      run: {
        onDate: { gte: prevWeekStart.toJSON() },
        siteId: { in: sites.map((s) => s.id) },
      },
    },
  });

  // Unique bot visits for the current and previous week (total counts)
  const botVisits = await prisma.botVisit.groupBy({
    by: ["siteId", "date"],
    _sum: { count: true },
    where: {
      siteId: { in: sites.map((s) => s.id) },
      date: { gte: new Date(prevWeekStart.toJSON()) },
    },
  });

  return sites.map((site) => {
    const [currentQueries, previousQueries] = partition(
      queries.filter((q) => q.run.siteId === site.id),
      (q) => q.run.onDate >= weekStart.toJSON(),
    );

    const [currentVisits, previousVisits] = partition(
      botVisits.filter((v) => v.siteId === site.id),
      (v) => v.date >= new Date(weekStart.toJSON()),
    );

    return {
      allCitations: {
        current: sumBy(currentQueries, (q) => q.citations.length),
        previous: sumBy(previousQueries, (q) => q.citations.length),
      },
      yourCitations: {
        current: sumBy(
          currentQueries,
          (q) => q.citations.filter((c) => c.includes(site.domain)).length,
        ),
        previous: sumBy(
          previousQueries,
          (q) => q.citations.filter((c) => c.includes(site.domain)).length,
        ),
      },
      visbilityScore: {
        current: calculateVisibilityScore({
          domain: site.domain,
          queries: currentQueries,
        }).visibilityScore,
        previous: calculateVisibilityScore({
          domain: site.domain,
          queries: previousQueries,
        }).visibilityScore,
      },
      botVisits: {
        current: sumBy(currentVisits, (v) => v._sum.count ?? 0),
        previous: sumBy(previousVisits, (v) => v._sum.count ?? 0),
      },
      site,
      isOwner: site.ownerId === userId,
    };
  });
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
