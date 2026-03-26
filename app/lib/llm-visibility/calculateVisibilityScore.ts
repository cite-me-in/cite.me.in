/**
 * Composite visibility score across four signal types:
 *
 * 1. Query Coverage Rate  — % of queries where domain appears in citations (0-100)
 * 2. Position-Weighted Rate — citation rate decayed by rank position (0-100)
 * 3. Share of Voice       — domain citations / total citations across all queries (0-100)
 * 4. Soft Mention Rate    — % of queries where domain name appears in response text,
 *                           with or without a URL citation (0-100)
 *
 * Composite weights:
 *   queryCoverageRate    × 0.35
 *   positionWeightedRate × 0.30
 *   shareOfVoice         × 0.20
 *   softMentionRate      × 0.15
 */

const weights = {
  queryCoverageRate: 0.35,
  positionWeightedRate: 0.3,
  shareOfVoice: 0.2,
  softMentionRate: 0.15,
} as const;

export default function calculateVisibilityScore({
  domain,
  queries,
}: {
  domain: string;
  queries: {
    citations: string[];
    position: number | null;
    text: string;
  }[];
}): {
  visibilityScore: number; // Weighted composite score (0–100)
  queryCoverageRate: number; // % of queries where domain appears in citations
  positionWeightedRate: number; // Position-decay weighted citation rate
  shareOfVoice: number; // Domain citations / total citations × 100
  softMentionRate: number; // % of queries where domain name appears in response text
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
  const domainNormalized = normalizeHostname(domain);
  let queriesWithCitation = 0;
  let positionWeightSum = 0;
  let domainCitations = 0;
  let totalCitations = 0;
  let queriesWithMention = 0;

  for (const query of queries) {
    for (const c of query.citations) {
      const host = normalizeHostname(c);
      if (!host) continue;
      totalCitations++;
      if (host === domainNormalized) domainCitations++;
    }

    // Query coverage + position weight
    if (query.position !== null) {
      queriesWithCitation++;
      // Reciprocal rank: position 0 → 1.0, position 1 → 0.5, position 4 → 0.2
      positionWeightSum += 1 / (query.position + 1);
    }

    // Soft mention: domain name appears anywhere in the LLM response text
    if (query.text.toLowerCase().includes(domainLower)) queriesWithMention++;
  }

  const queryCoverageRate = (queriesWithCitation / totalQueries) * 100;
  const positionWeightedRate = (positionWeightSum / totalQueries) * 100;
  const shareOfVoice =
    totalCitations === 0 ? 0 : (domainCitations / totalCitations) * 100;
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
    domainCitations,
    totalCitations,
    totalQueries,
  };
}

/**
 * Normalize a hostname or URL to a lowercase hostname without the "www." prefix.
 *
 * @param input - The hostname or URL to normalize.
 * @returns The normalized hostname or an empty string if the input is not a valid URL.
 */
export function normalizeHostname(input: string): string {
  try {
    const url = /^https?:\/\//.test(input)
      ? new URL(input)
      : new URL(`https://${input}`);
    const lower = url.hostname.toLowerCase();
    return lower.startsWith("www.") ? lower.slice(4) : lower;
  } catch {
    return "";
  }
}
