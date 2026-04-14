/**
 * Composite visibility score across four signal types:
 *
 * 1. Query Coverage Rate  — % of queries where domain appears in citations (0-100)
 * 2. Position-Weighted Rate — citation rate decayed by rank position (0-100)
 * 3. Share of Voice       — domain citations / total citations across all queries (0-100)
 *    Now includes direct + indirect×0.5 citations from LLM classification
 * 4. Soft Mention Rate    — % of queries where domain name appears in response text,
 *                           with or without a URL citation (0-100)
 *
 * Composite weights:
 *   queryCoverageRate    × 0.35
 *   positionWeightedRate × 0.30
 *   shareOfVoice         × 0.20
 *   softMentionRate      × 0.15
 */

import { isSameDomain, normalizeDomain } from "../isSameDomain";

const weights = {
  queryCoverageRate: 0.35,
  positionWeightedRate: 0.3,
  shareOfVoice: 0.2,
  softMentionRate: 0.15,
} as const;

export default function calculateVisibilityScore({
  domain,
  queries,
  classifications,
}: {
  domain: string;
  queries: {
    citations: string[];
    text: string;
  }[];
  classifications?: {
    url: string;
    relationship: string;
  }[];
}): {
  visibilityScore: number;
  queryCoverageRate: number;
  positionWeightedRate: number;
  shareOfVoice: number;
  softMentionRate: number;
  queriesWithCitation: number;
  queriesWithMention: number;
  domainCitations: number;
  totalCitations: number;
  totalQueries: number;
} {
  const totalQueries = queries.length;
  if (totalQueries === 0)
    return {
      visibilityScore: 0,
      queryCoverageRate: 0,
      positionWeightedRate: 0,
      shareOfVoice: 0,
      softMentionRate: 0,
      queriesWithCitation: 0,
      queriesWithMention: 0,
      domainCitations: 0,
      totalCitations: 0,
      totalQueries: 0,
    };

  const domainLower = domain.toLowerCase();
  const domainNormalized = normalizeDomain(domain);
  let queriesWithCitation = 0;
  let positionWeightSum = 0;
  let exactCitations = 0;
  let totalCitations = 0;
  let queriesWithMention = 0;

  const directUrls = new Set<string>();
  const indirectUrls = new Set<string>();

  if (classifications) {
    for (const c of classifications) {
      const normalized = normalizeUrl(c.url);
      if (c.relationship === "direct") {
        directUrls.add(normalized);
      } else if (c.relationship === "indirect") {
        indirectUrls.add(normalized);
      }
    }
  }

  for (const query of queries) {
    for (const c of query.citations) {
      const host = normalizeDomain(c);
      if (!host) continue;
      totalCitations++;
      if (host === domainNormalized) exactCitations++;
    }

    const position = query.citations.findIndex((c) =>
      isSameDomain({ domain, url: c }),
    );

    const hasDirectCitation =
      position !== -1 ||
      query.citations.some((c) => directUrls.has(normalizeUrl(c)));

    if (hasDirectCitation) queriesWithCitation++;

    if (position !== -1) positionWeightSum += 1 / (position + 1);

    if (query.text.toLowerCase().includes(domainLower)) queriesWithMention++;
  }

  const queryCoverageRate = (queriesWithCitation / totalQueries) * 100;
  const positionWeightedRate = (positionWeightSum / totalQueries) * 100;

  const directCount = directUrls.size;
  const indirectCount = indirectUrls.size;
  const weightedCitations = exactCitations + directCount + indirectCount * 0.5;

  const shareOfVoice =
    totalCitations === 0 ? 0 : (weightedCitations / totalCitations) * 100;
  const softMentionRate = (queriesWithMention / totalQueries) * 100;

  const visibilityScore =
    queryCoverageRate * weights.queryCoverageRate +
    positionWeightedRate * weights.positionWeightedRate +
    shareOfVoice * weights.shareOfVoice +
    softMentionRate * weights.softMentionRate;

  return {
    visibilityScore: +visibilityScore.toFixed(1),
    queryCoverageRate: +queryCoverageRate.toFixed(1),
    positionWeightedRate: +positionWeightedRate.toFixed(1),
    shareOfVoice: +shareOfVoice.toFixed(1),
    softMentionRate: +softMentionRate.toFixed(1),
    queriesWithCitation,
    queriesWithMention,
    domainCitations: weightedCitations,
    totalCitations,
    totalQueries,
  };
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
