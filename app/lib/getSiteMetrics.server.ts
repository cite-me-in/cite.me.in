import { Temporal } from "@js-temporal/polyfill";
import { fork, sum } from "radashi";
import type { Site } from "~/prisma";
import calculateVisibilityScore, {
  normalizeHostname,
} from "./llm-visibility/calculateVisibilityScore";
import prisma from "./prisma.server";

/**
 * Get site metrics for the current and previous week for all sites the user has access to.
 *
 * @param userId
 * @returns Site metrics for the current and previous week
 */
export default async function getSiteMetrics(
  filter: { userId: string; } | { siteIds: string[]; },
): Promise<
  {
    site: Pick<Site, "id" | "domain" | "ownerId" | "summary">;
    // Total citations for the current and previous week
    allCitations: { current: number; previous: number; };
    // Your citations only for the current and previous week
    yourCitations: { current: number; previous: number; };
    // Visibility score for the current and previous week
    visbilityScore: { current: number; previous: number; };
    // Unique bot visits for the current and previous week
    botVisits: { current: number; previous: number; };
  }[]
> {
  const weekStart = Temporal.Now.plainDateISO("UTC").subtract({ days: 7 });
  const prevWeekStart = weekStart.subtract({ days: 7 });

  // Get all sites the user has access to as owner or member, sorted alphabetically.
  const sites = await prisma.site.findMany({
    select: {
      domain: true,
      id: true,
      ownerId: true,
      summary: true,
    },
    orderBy: [{ domain: "asc" }],
    where:
      "userId" in filter
        ? { OR: [{ ownerId: filter.userId }, { siteUsers: { some: { userId: filter.userId } } }] }
        : { id: { in: filter.siteIds } },
  });

  // Get all citation queries for the current and previous week for all sites
  // the user has access to.
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
    const domain = normalizeHostname(site.domain);

    const [currentQueries, previousQueries] = fork(
      queries.filter((q) => q.run.siteId === site.id),
      (q) => q.run.onDate >= weekStart.toJSON(),
    );

    const [currentVisits, previousVisits] = fork(
      botVisits.filter((v) => v.siteId === site.id),
      (v) => v.date >= new Date(weekStart.toJSON()),
    );

    return {
      allCitations: {
        current: sum(currentQueries, (q) => q.citations.length),
        previous: sum(previousQueries, (q) => q.citations.length),
      },
      yourCitations: {
        current: sum(
          currentQueries,
          (q) =>
            q.citations.filter((c) => normalizeHostname(c) === domain).length,
        ),
        previous: sum(
          previousQueries,
          (q) =>
            q.citations.filter((c) => normalizeHostname(c) === domain).length,
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
        current: sum(currentVisits, (v) => v._sum.count ?? 0),
        previous: sum(previousVisits, (v) => v._sum.count ?? 0),
      },
      site,
    };
  });
}
