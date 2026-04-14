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

    const currentDirectUrls = new Set(
      currentClassifications
        .filter((c) => c.relationship === "direct")
        .map((c) => normalizeUrl(c.url)),
    );
    const currentIndirectUrls = new Set(
      currentClassifications
        .filter((c) => c.relationship === "indirect")
        .map((c) => normalizeUrl(c.url)),
    );
    const previousDirectUrls = new Set(
      previousClassifications
        .filter((c) => c.relationship === "direct")
        .map((c) => normalizeUrl(c.url)),
    );
    const previousIndirectUrls = new Set(
      previousClassifications
        .filter((c) => c.relationship === "indirect")
        .map((c) => normalizeUrl(c.url)),
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

    const countYourCitations = (
      queries: typeof currentQueries,
      domain: string,
      directUrls: Set<string>,
      indirectUrls: Set<string>,
    ) => {
      let count = 0;
      for (const q of queries) {
        for (const c of q.citations) {
          const normalized = normalizeUrl(c);
          const host = normalizeDomain(c);
          if (
            host === domain ||
            directUrls.has(normalized) ||
            indirectUrls.has(normalized)
          ) {
            count++;
          }
        }
      }
      return count;
    };

    return {
      allCitations: {
        current: sum(currentQueries, (q) => q.citations.length),
        previous: sum(previousQueries, (q) => q.citations.length),
      },
      yourCitations: {
        current: countYourCitations(
          currentQueries,
          domain,
          currentDirectUrls,
          currentIndirectUrls,
        ),
        previous: countYourCitations(
          previousQueries,
          domain,
          previousDirectUrls,
          previousIndirectUrls,
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

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete("utm_source");
    parsed.searchParams.delete("utm_medium");
    parsed.searchParams.delete("utm_campaign");
    parsed.searchParams.delete("utm_term");
    parsed.searchParams.delete("utm_content");
    return parsed.origin + parsed.pathname + parsed.search;
  } catch {
    return url;
  }
}
