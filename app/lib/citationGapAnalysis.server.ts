import nonCompetitors from "~/routes/site.$domain_.citations/nonCompetitors";

export function getCitationGaps({
  citations,
  queries,
  ownDomain,
}: {
  citations: { url: string; domain: string; queryId: string }[];
  queries: { id: string; query: string }[];
  ownDomain: string;
}): { competitorDomain: string; queries: { id: string; query: string }[] }[] {
  const queryMap = new Map(queries.map((q) => [q.id, q]));

  const ownQueryIds = new Set(
    citations.filter((c) => c.domain === ownDomain).map((c) => c.queryId),
  );

  const competitorQueries = new Map<string, Set<string>>();
  for (const c of citations) {
    if (c.domain === ownDomain) continue;
    if (nonCompetitors.has(c.domain)) continue;
    if (nonCompetitors.has(c.domain.split(".").slice(1).join("."))) continue;
    if (!competitorQueries.has(c.domain))
      competitorQueries.set(c.domain, new Set());
    competitorQueries.get(c.domain)?.add(c.queryId);
  }

  const gaps: {
    competitorDomain: string;
    queries: { id: string; query: string }[];
  }[] = [];
  for (const [domain, queryIds] of competitorQueries) {
    const gapQueryIds = [...queryIds].filter((id) => !ownQueryIds.has(id));
    if (gapQueryIds.length === 0) continue;
    gaps.push({
      competitorDomain: domain,
      queries: gapQueryIds.flatMap((id) => {
        const q = queryMap.get(id);
        return q ? [q] : [];
      }),
    });
  }

  return gaps.sort((a, b) => b.queries.length - a.queries.length);
}
