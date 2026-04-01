import { sum } from "radashi";
import type { SetupMetrics } from "~/emails/SiteSetupComplete";
import { getDomainMeta } from "~/lib/domainMeta.server";
import prisma from "~/lib/prisma.server";
import { topCompetitors } from "~/routes/site.$domain_.citations/TopCompetitors";

export default async function loadSetupMetrics(
  siteId: string,
): Promise<SetupMetrics> {
  const site = await prisma.site.findUniqueOrThrow({
    where: { id: siteId },
    select: { domain: true },
  });

  // Latest run per platform (setup runs one per platform on a single day)
  const runs = await prisma.citationQueryRun.findMany({
    where: { siteId },
    select: {
      platform: true,
      queries: { select: { query: true, citations: true } },
      sentimentLabel: true,
      sentimentSummary: true,
    },
    orderBy: { onDate: "desc" },
    distinct: ["platform"],
  });

  const byPlatform: SetupMetrics["byPlatform"] = {};
  for (const run of runs) {
    byPlatform[run.platform] = {
      citations: sum(run.queries, (q) => q.citations.length),
      sentimentLabel: run.sentimentLabel,
      sentimentSummary: run.sentimentSummary,
    };
  }

  const queryCounts = new Map<string, number>();
  for (const run of runs)
    for (const q of run.queries)
      queryCounts.set(
        q.query,
        (queryCounts.get(q.query) ?? 0) + q.citations.length,
      );

  const topQueries = [...queryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([query, count]) => ({ query, count }));

  const allQueries = runs.flatMap((r) => r.queries);
  const { competitors: rawCompetitors } = topCompetitors(allQueries, site.domain);
  const competitors = await Promise.all(
    rawCompetitors.map(async (c) => ({
      ...c,
      ...(await getDomainMeta(c.domain)),
    })),
  );

  return {
    totalCitations: sum(Object.values(byPlatform), (p) => p.citations),
    byPlatform,
    topQueries,
    competitors,
  };
}
