import { expect } from "playwright/test";
import { beforeAll, describe, it } from "vitest";
import { port } from "~/test/helpers/launchBrowser";

describe("blog/feed", () => {
  let content: string;
  let response: Response;

  beforeAll(async () => {
    response = await fetch(`http://localhost:${port}/blog/feed`);
    content = await response.text();
  });

  it("should return Atom XML content type", () => {
    expect(response.headers.get("content-type")).toContain(
      "application/atom+xml",
    );
  });

  it("should include cache-control header", () => {
    expect(response.headers.get("cache-control")).toContain("public");
  });

  it("should be valid Atom XML", () => {
    expect(content).toContain('<?xml version="1.0" encoding="utf-8"?>');
    expect(content).toContain("<feed");
    expect(content).toContain("</feed>");
  });

  it("should have CiteUp as feed title", () => {
    expect(content).toContain("<title>The CiteUp Blog</title>");
  });

  it("should link to citeup.com", () => {
    expect(content).toContain("citeup.com");
  });

  it("should include at least one entry", () => {
    expect(content).toContain("<entry>");
  });

  it("should include the first blog post", () => {
    expect(content).toContain("2026-02-26-how-citeup-was-born");
    expect(content).toContain(
      "How CiteUp Was Born: From Rentail to LLM Citation Monitoring",
    );
  });
});
