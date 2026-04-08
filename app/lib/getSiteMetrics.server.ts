import { Temporal } from "@js-temporal/polyfill";
import { fork, sum } from "radashi";
import type { Site } from "~/prisma";
import { normalizeDomain } from "./isSameDomain";
import calculateVisibilityScore from "./llm-visibility/calculateVisibilityScore";
import prisma from "./prisma.server";

type WeekMetrics = { current: number; previous: number };

/**
 * Get site metrics for the current and previous week for all sites the user has access to.
 *
 * @param userId
 * @returns Site metrics for the current and previous week
 */
export default async function getSiteMetrics(
  filter: { userId: string } | { siteIds: string[] },
): Promise<
  {
    site: Pick<Site, "id" | "domain" | "ownerId" | "summary">;
    allCitations: WeekMetrics;
    yourCitations: WeekMetrics;
    visbilityScore: WeekMetrics;
    queryCoverageRate: WeekMetrics;
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
        ? {
            OR: [
              { ownerId: filter.userId },
              { siteUsers: { some: { userId: filter.userId } } },
            ],
          }
        : { id: { in: filter.siteIds } },
  });

  // Get all citation queries for the current and previous week for all sites
  // the user has access to.
  const queries = await prisma.citationQuery.findMany({
    select: {
      citations: true,
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

  return sites.map((site) => {
    const domain = normalizeDomain(site.domain);

    const [currentQueries, previousQueries] = fork(
      queries.filter((q) => q.run.siteId === site.id),
      (q) => q.run.onDate >= weekStart.toJSON(),
    );

    const currentScore = calculateVisibilityScore({
      domain: site.domain,
      queries: currentQueries,
    });
    const previousScore = calculateVisibilityScore({
      domain: site.domain,
      queries: previousQueries,
    });

    return {
      allCitations: {
        current: sum(currentQueries, (q) => q.citations.length),
        previous: sum(previousQueries, (q) => q.citations.length),
      },
      yourCitations: {
        current: sum(
          currentQueries,
          (q) =>
            q.citations.filter((c) => normalizeDomain(c) === domain).length,
        ),
        previous: sum(
          previousQueries,
          (q) =>
            q.citations.filter((c) => normalizeDomain(c) === domain).length,
        ),
      },
      visbilityScore: {
        current: currentScore.visibilityScore,
        previous: previousScore.visibilityScore,
      },
      queryCoverageRate: {
        current: currentScore.queryCoverageRate,
        previous: previousScore.queryCoverageRate,
      },
      site,
    };
  });
}
