import { describe, expect, it } from "vitest";
import { getCitationGaps } from "~/lib/citationGapAnalysis.server";

describe("getCitationGaps", () => {
  it("should identify queries where competitor appears but own domain does not", () => {
    const citations = [
      { url: "https://competitor.com/a", domain: "competitor.com", queryId: "q1" },
      { url: "https://mysite.com/page", domain: "mysite.com", queryId: "q1" },
      { url: "https://competitor.com/b", domain: "competitor.com", queryId: "q2" },
    ];
    const queries = [
      { id: "q1", query: "how to find retail space" },
      { id: "q2", query: "short term retail leasing" },
    ];

    const gaps = getCitationGaps({ citations, queries, ownDomain: "mysite.com" });

    expect(gaps).toHaveLength(1);
    expect(gaps[0].competitorDomain).toBe("competitor.com");
    expect(gaps[0].queries).toHaveLength(1);
    expect(gaps[0].queries[0].query).toBe("short term retail leasing");
  });

  it("should return empty when own domain appears in all queries with competitor", () => {
    const citations = [
      { url: "https://competitor.com/a", domain: "competitor.com", queryId: "q1" },
      { url: "https://mysite.com/page", domain: "mysite.com", queryId: "q1" },
    ];
    const queries = [{ id: "q1", query: "query one" }];

    const gaps = getCitationGaps({ citations, queries, ownDomain: "mysite.com" });
    expect(gaps).toHaveLength(0);
  });

  it("should exclude non-competitor domains", () => {
    const citations = [
      { url: "https://reddit.com/r/retail", domain: "reddit.com", queryId: "q1" },
    ];
    const queries = [{ id: "q1", query: "query one" }];
    const gaps = getCitationGaps({ citations, queries, ownDomain: "mysite.com" });
    expect(gaps).toHaveLength(0);
  });
});
