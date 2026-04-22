import { expect } from "playwright/test";
import { beforeAll, describe, it } from "vitest";
import { port } from "../helpers/launchBrowser";

describe("robots.txt", () => {
  let lines: string[];
  let statements: string[];

  beforeAll(async () => {
    const response = await fetch(`http://localhost:${port}/robots.txt`);
    const content = await response.text();
    lines = content.split("\n").filter(Boolean);
    statements = lines.filter((line) => !line.startsWith("#"));
  });

  it("should reference sitemap.xml", () => {
    expect(statements).toContain("Sitemap: http://localhost:9222/sitemap.xml");
  });

  it("should reference sitemap.txt", () => {
    expect(statements).toContain("Sitemap: http://localhost:9222/sitemap.txt");
  });

  it("should reference blog sitemap.xml", () => {
    expect(statements).toContain("Sitemap: https://blog.cite.me.in/sitemap.xml");
  });

  it("should allow all user agents", () => {
    expect(statements).toContain("User-agent: *");
  });

  it("should allow crawling of root path", () => {
    expect(statements).toContain("Allow: /");
  });

  it("should disallow /error", () => {
    expect(statements).toContain("Disallow: /error");
  });

  it("should explicitly allow AI crawlers", () => {
    expect(statements).toContain("User-agent: GPTBot");
    expect(statements).toContain("User-agent: ClaudeBot");
    expect(statements).toContain("User-agent: anthropic-ai");
  });
});
