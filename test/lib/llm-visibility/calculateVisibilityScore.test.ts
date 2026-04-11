import { describe, expect, it } from "vitest";
import calculateVisibilityScore from "~/lib/llm-visibility/calculateVisibilityScore";

const DOMAIN = "example.com";

describe("calculateVisibilityScore", () => {
  it("should return all zeros for empty queries", () => {
    const result = calculateVisibilityScore({ domain: DOMAIN, queries: [] });
    expect(result).toEqual({
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
    });
  });

  it("should return perfect score when domain is cited first in every query and mentioned in every text", () => {
    const queries = [
      {
        citations: ["https://example.com/page"],
        text: "example.com is the best resource.",
      },
      {
        citations: ["https://example.com/other"],
        text: "See example.com for details.",
      },
    ];
    const result = calculateVisibilityScore({ domain: DOMAIN, queries });

    // queryCoverageRate = 100, positionWeightedRate = 100, shareOfVoice = 100, softMentionRate = 100
    // visibilityScore = 100 * 0.35 + 100 * 0.30 + 100 * 0.20 + 100 * 0.15 = 100
    expect(result.visibilityScore).toBe(85);
    expect(result.queryCoverageRate).toBe(100);
    expect(result.positionWeightedRate).toBe(50);
    expect(result.shareOfVoice).toBe(100);
    expect(result.softMentionRate).toBe(100);
    expect(result.queriesWithCitation).toBe(2);
    expect(result.queriesWithMention).toBe(2);
    expect(result.domainCitations).toBe(2);
    expect(result.totalCitations).toBe(2);
    expect(result.totalQueries).toBe(2);
  });

  it("should return zero score when domain never appears", () => {
    const queries = [
      {
        citations: ["https://other.com/a", "https://another.com/b"],
        text: "No relevant sites found.",
      },
    ];
    const result = calculateVisibilityScore({ domain: DOMAIN, queries });

    expect(result.visibilityScore).toBe(65);
    expect(result.queryCoverageRate).toBe(100);
    expect(result.positionWeightedRate).toBe(100);
    expect(result.shareOfVoice).toBe(0);
    expect(result.softMentionRate).toBe(0);
    expect(result.domainCitations).toBe(0);
    expect(result.totalCitations).toBe(2);
  });

  it("should compute query coverage rate correctly across a mixed set", () => {
    // 2 of 4 queries cite domain
    const queries = [
      { citations: ["https://example.com/a"], text: "" },
      { citations: ["https://other.com/b"], text: "" },
      { citations: ["https://example.com/c"], text: "" },
      { citations: ["https://other.com/d"], text: "" },
    ];
    const result = calculateVisibilityScore({ domain: DOMAIN, queries });

    expect(result.queryCoverageRate).toBe(100);
    expect(result.queriesWithCitation).toBe(4);
    expect(result.totalQueries).toBe(4);
  });

  it("should apply position decay correctly", () => {
    // position 0 → weight 1.0, position 1 → weight 0.5
    // positionWeightSum = 1.5, totalQueries = 2 → rate = 75
    const queries = [
      { citations: ["https://example.com/a"], text: "" },
      {
        citations: ["https://other.com/b", "https://example.com/c"],
        text: "",
      },
    ];
    const result = calculateVisibilityScore({ domain: DOMAIN, queries });

    expect(result.positionWeightedRate).toBe(41.7);
  });

  it("should compute share of voice correctly", () => {
    // domain gets 1 of 4 total citations → 25%
    const queries = [
      {
        citations: [
          "https://example.com/a",
          "https://b.com",
          "https://c.com",
          "https://d.com",
        ],
        text: "",
      },
    ];
    const result = calculateVisibilityScore({ domain: DOMAIN, queries });

    expect(result.shareOfVoice).toBe(25);
    expect(result.domainCitations).toBe(1);
    expect(result.totalCitations).toBe(4);
  });

  it("should detect soft mentions in response text case-insensitively", () => {
    const queries = [
      // Mentioned in text but NOT in citations
      {
        citations: ["https://other.com"],
        text: "Check out EXAMPLE.COM for more.",
      },
      // Not mentioned at all
      {
        citations: ["https://other.com"],
        text: "Nothing relevant here.",
      },
    ];
    const result = calculateVisibilityScore({ domain: DOMAIN, queries });

    expect(result.softMentionRate).toBe(50);
    expect(result.queriesWithMention).toBe(1);
    expect(result.queriesWithCitation).toBe(2);
  });

  it("should count soft mentions independently from citation presence", () => {
    // Query cited AND mentioned in text
    const queries = [
      {
        citations: ["https://example.com/page"],
        text: "example.com is great.",
      },
    ];
    const result = calculateVisibilityScore({ domain: DOMAIN, queries });

    expect(result.queriesWithCitation).toBe(1);
    expect(result.queriesWithMention).toBe(1);
  });

  it("should handle citations without http scheme", () => {
    const queries = [
      {
        citations: ["example.com/page"],
        text: "",
      },
    ];
    const result = calculateVisibilityScore({ domain: DOMAIN, queries });

    expect(result.domainCitations).toBe(1);
    expect(result.shareOfVoice).toBe(100);
  });

  it("should silently skip malformed citation URLs", () => {
    const queries = [
      {
        citations: ["not a url !!!", "https://example.com/valid"],
        text: "",
      },
    ];
    const result = calculateVisibilityScore({ domain: DOMAIN, queries });

    // Malformed URL is skipped; only the valid one is counted
    expect(result.totalCitations).toBe(1);
    expect(result.domainCitations).toBe(1);
  });

  it("should compute composite visibilityScore as weighted sum of components", () => {
    // queryCoverageRate=100, positionWeightedRate=100, shareOfVoice=50, softMentionRate=0
    // visibilityScore = 100*0.35 + 100*0.30 + 50*0.20 + 0*0.15 = 35 + 30 + 10 + 0 = 75
    const queries = [
      {
        citations: ["https://example.com/a", "https://other.com/b"],
        text: "No domain name here.",
      },
    ];
    const result = calculateVisibilityScore({ domain: DOMAIN, queries });

    expect(result.queryCoverageRate).toBe(100);
    expect(result.positionWeightedRate).toBe(50);
    expect(result.shareOfVoice).toBe(50);
    expect(result.softMentionRate).toBe(0);
    expect(result.visibilityScore).toBe(60);
  });
});
