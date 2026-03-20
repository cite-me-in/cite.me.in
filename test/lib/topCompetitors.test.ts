import { describe, expect, it } from "vitest";
import { topCompetitors } from "~/routes/site.$domain_.citations/TopCompetitors";

describe("topCompetitors", () => {
  it("should count competitor domains and exclude own domain", () => {
    const queries = [
      {
        citations: [
          "https://mysite.com/page",
          "https://competitor.com/a",
          "https://other.com/b",
        ],
      },
    ];
    const { competitors } = topCompetitors(queries, "mysite.com");
    expect(competitors.map((c) => c.domain)).toEqual([
      "competitor.com",
      "other.com",
    ]);
    expect(competitors.find((c) => c.domain === "mysite.com")).toBeUndefined();
  });

  it("should strip www prefix before counting", () => {
    const queries = [
      {
        citations: [
          "https://www.competitor.com/a",
          "https://competitor.com/b",
          "https://www.competitor.com/c",
        ],
      },
    ];
    const { competitors } = topCompetitors(queries, "mysite.com");
    expect(competitors).toHaveLength(1);
    expect(competitors[0].domain).toBe("competitor.com");
    expect(competitors[0].count).toBe(3);
  });

  it("should return top 5 competitors sorted by count descending", () => {
    const citations = [
      "https://a.com/1",
      "https://a.com/2",
      "https://a.com/3", // 3
      "https://b.com/1",
      "https://b.com/2", // 2
      "https://c.com/1",
      "https://c.com/2",
      "https://c.com/3",
      "https://c.com/4", // 4
      "https://d.com/1", // 1 — should be excluded (6th)
      "https://e.com/1",
      "https://e.com/2", // 2
      "https://f.com/1",
      "https://f.com/2",
      "https://f.com/3", // 3
    ];
    const { competitors } = topCompetitors([{ citations }], "mysite.com");
    expect(competitors).toHaveLength(5);
    expect(competitors[0].domain).toBe("c.com"); // 4 — clear winner
    expect(competitors.map((c) => c.domain)).not.toContain("d.com");
    // Remaining order: sort stable by count desc; just verify counts are non-increasing
    for (let i = 1; i < competitors.length; i++)
      expect(competitors[i].count).toBeLessThanOrEqual(competitors[i - 1].count);
  });

  it("should calculate percentage of total citations", () => {
    const queries = [
      {
        citations: [
          "https://mysite.com/page",
          "https://competitor.com/a",
          "https://competitor.com/b",
          "https://competitor.com/c",
        ],
      },
    ];
    // total = 4, competitor.com = 3 → 75%
    const { total, competitors } = topCompetitors(queries, "mysite.com");
    expect(total).toBe(4);
    expect(competitors[0].pct).toBe(75);
  });

  it("should return empty competitors when all citations are own domain", () => {
    const queries = [
      { citations: ["https://mysite.com/a", "https://mysite.com/b"] },
    ];
    const { competitors } = topCompetitors(queries, "mysite.com");
    expect(competitors).toHaveLength(0);
  });

  it("should return empty competitors when there are no citations", () => {
    const { competitors, total } = topCompetitors([{ citations: [] }], "mysite.com");
    expect(competitors).toHaveLength(0);
    expect(total).toBe(0);
  });

  it("should skip invalid URLs", () => {
    const queries = [
      {
        citations: [
          "not-a-url",
          "https://competitor.com/valid",
          "also-invalid",
        ],
      },
    ];
    const { competitors, total } = topCompetitors(queries, "mysite.com");
    expect(total).toBe(1);
    expect(competitors[0].domain).toBe("competitor.com");
  });

  it("should aggregate citations across multiple queries", () => {
    const queries = [
      { citations: ["https://a.com/1", "https://b.com/1"] },
      { citations: ["https://a.com/2", "https://c.com/1"] },
      { citations: ["https://a.com/3", "https://b.com/2"] },
    ];
    const { competitors } = topCompetitors(queries, "mysite.com");
    expect(competitors[0]).toMatchObject({ domain: "a.com", count: 3 });
    expect(competitors[1]).toMatchObject({ domain: "b.com", count: 2 });
    expect(competitors[2]).toMatchObject({ domain: "c.com", count: 1 });
  });
});
