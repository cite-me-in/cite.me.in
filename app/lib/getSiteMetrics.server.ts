import { Temporal } from "@js-temporal/polyfill";
import { fork, sum } from "radashi";
import type { Site } from "~/prisma";
import { normalizeDomain } from "./isSameDomain";
import calculateVisibilityScore from "./llm-visibility/calculateVisibilityScore";
import prisma from "./prisma.server";

type WeekMetrics = { current: number; previous: number };

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

  const queries = await prisma.citationQuery.findMany({
    select: {
      citations: true,
      text: true,
      createdAt: true,
      run: {
        select: {
          id: true,
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

  const runIds = [...new Set(queries.map((q) => q.run.id))];
  const classifications = await prisma.citationClassification.findMany({
    where: {
      runId: { in: runIds },
    },
  });

  return sites.map((site) => {
    const domain = normalizeDomain(site.domain);
    const siteQueries = queries.filter((q) => q.run.siteId === site.id);

    const [currentQueries, previousQueries] = fork(
      siteQueries,
      (q) => q.run.onDate >= weekStart.toJSON(),
    );

    const currentRunIds = new Set(currentQueries.map((q) => q.run.id));
    const previousRunIds = new Set(previousQueries.map((q) => q.run.id));

    const currentClassifications = classifications.filter((c) =>
      currentRunIds.has(c.runId),
    );
    const previousClassifications = classifications.filter((c) =>
      previousRunIds.has(c.runId),
    );

    const currentScore = calculateVisibilityScore({
      domain: site.domain,
      queries: currentQueries,
      classifications: currentClassifications,
    });
    const previousScore = calculateVisibilityScore({
      domain: site.domain,
      queries: previousQueries,
      classifications: previousClassifications,
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
