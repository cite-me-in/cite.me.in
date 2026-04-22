import { describe, expect, it } from "vite-plus/test";
import { topCompetitors } from "~/routes/site.$domain_.citations/TopCompetitors";

describe("topCompetitors", () => {
  it("should count competitor domains and exclude own domain", () => {
    const citations = [
      { url: "https://mysite.com/page", domain: "mysite.com" },
      { url: "https://competitor.com/a", domain: "competitor.com" },
      { url: "https://other.com/b", domain: "other.com" },
    ];
    const { competitors } = topCompetitors(citations, "mysite.com");
    expect(competitors.map((c) => c.domain)).toEqual([
      "competitor.com",
      "other.com",
    ]);
    expect(competitors.find((c) => c.domain === "mysite.com")).toBeUndefined();
  });

  it("should strip www prefix before counting", () => {
    const citations = [
      { url: "https://www.competitor.com/a", domain: "competitor.com" },
      { url: "https://competitor.com/b", domain: "competitor.com" },
      { url: "https://www.competitor.com/c", domain: "competitor.com" },
    ];
    const { competitors } = topCompetitors(citations, "mysite.com");
    expect(competitors).toHaveLength(1);
    expect(competitors[0].domain).toBe("competitor.com");
    expect(competitors[0].count).toBe(3);
  });

  it("should return top 5 competitors sorted by count descending", () => {
    const citations = [
      { url: "https://a.com/1", domain: "a.com" },
      { url: "https://a.com/2", domain: "a.com" },
      { url: "https://a.com/3", domain: "a.com" }, // 3
      { url: "https://b.com/1", domain: "b.com" },
      { url: "https://b.com/2", domain: "b.com" }, // 2
      { url: "https://c.com/1", domain: "c.com" },
      { url: "https://c.com/2", domain: "c.com" },
      { url: "https://c.com/3", domain: "c.com" },
      { url: "https://c.com/4", domain: "c.com" }, // 4
      { url: "https://d.com/1", domain: "d.com" }, // 1 — should be excluded (6th)
      { url: "https://e.com/1", domain: "e.com" },
      { url: "https://e.com/2", domain: "e.com" }, // 2
      { url: "https://f.com/1", domain: "f.com" },
      { url: "https://f.com/2", domain: "f.com" },
      { url: "https://f.com/3", domain: "f.com" }, // 3
    ];
    const { competitors } = topCompetitors(citations, "mysite.com");
    expect(competitors).toHaveLength(5);
    expect(competitors[0].domain).toBe("c.com"); // 4 — clear winner
    expect(competitors.map((c) => c.domain)).not.toContain("d.com");
    // Remaining order: sort stable by count desc; just verify counts are non-increasing
    for (let i = 1; i < competitors.length; i++)
      expect(competitors[i].count).toBeLessThanOrEqual(
        competitors[i - 1].count,
      );
  });

  it("should calculate percentage of total citations", () => {
    const citations = [
      { url: "https://mysite.com/page", domain: "mysite.com" },
      { url: "https://competitor.com/a", domain: "competitor.com" },
      { url: "https://competitor.com/b", domain: "competitor.com" },
      { url: "https://competitor.com/c", domain: "competitor.com" },
    ];
    // total = 4, competitor.com = 3 → 75%
    const { total, competitors } = topCompetitors(citations, "mysite.com");
    expect(total).toBe(4);
    expect(competitors[0].pct).toBe(75);
  });

  it("should return empty competitors when all citations are own domain", () => {
    const citations = [
      { url: "https://mysite.com/a", domain: "mysite.com" },
      { url: "https://mysite.com/b", domain: "mysite.com" },
    ];
    const { competitors } = topCompetitors(citations, "mysite.com");
    expect(competitors).toHaveLength(0);
  });

  it("should return empty competitors when there are no citations", () => {
    const { competitors, total } = topCompetitors([], "mysite.com");
    expect(competitors).toHaveLength(0);
    expect(total).toBe(0);
  });

  it("should exclude non-competitor domains (Reddit, Wikipedia, etc.)", () => {
    const citations = [
      { url: "https://reddit.com/r/retail/post", domain: "reddit.com" },
      { url: "https://en.wikipedia.org/wiki/Retail", domain: "wikipedia.org" },
      { url: "https://competitor.com/page", domain: "competitor.com" },
      { url: "https://youtube.com/watch?v=abc", domain: "youtube.com" },
      { url: "https://linkedin.com/in/someone", domain: "linkedin.com" },
    ];
    const { competitors } = topCompetitors(citations, "mysite.com");
    expect(competitors).toHaveLength(1);
    expect(competitors[0].domain).toBe("competitor.com");
  });

  it("should aggregate citations across multiple entries", () => {
    const citations = [
      { url: "https://a.com/1", domain: "a.com" },
      { url: "https://b.com/1", domain: "b.com" },
      { url: "https://a.com/2", domain: "a.com" },
      { url: "https://c.com/1", domain: "c.com" },
      { url: "https://a.com/3", domain: "a.com" },
      { url: "https://b.com/2", domain: "b.com" },
    ];
    const { competitors } = topCompetitors(citations, "mysite.com");
    expect(competitors[0]).toMatchObject({ domain: "a.com", count: 3 });
    expect(competitors[1]).toMatchObject({ domain: "b.com", count: 2 });
    expect(competitors[2]).toMatchObject({ domain: "c.com", count: 1 });
  });
});
