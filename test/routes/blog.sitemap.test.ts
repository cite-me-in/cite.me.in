import { XMLParser } from "fast-xml-parser";
import { expect } from "playwright/test";
import { beforeAll, describe, it } from "vitest";
import { port } from "~/test/helpers/launchBrowser";

describe("blog/sitemap.xml", () => {
  let sitemapContent: string;
  let response: Response;
  let xml: { urlset: { url: { loc: string; lastmod: string }[] } };

  beforeAll(async () => {
    response = await fetch(`http://localhost:${port}/blog/sitemap.xml`);
    sitemapContent = await response.text();

    const parser = new XMLParser();
    xml = parser.parse(sitemapContent);
  });

  it("should return XML content type", () => {
    expect(response.headers.get("content-type")).toContain("application/xml");
  });

  it("should be valid XML with urlset", () => {
    expect(sitemapContent).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toHaveProperty("urlset");
    expect(xml.urlset).toHaveProperty("url");
  });

  it("should include blog post URLs under citeup.com/blog/", () => {
    const urls = Array.isArray(xml.urlset.url)
      ? xml.urlset.url
      : [xml.urlset.url];
    expect(urls.some((u) => u.loc.startsWith("https://citeup.com/blog/"))).toBe(
      true,
    );
  });

  it("should include the first post", () => {
    const urls = Array.isArray(xml.urlset.url)
      ? xml.urlset.url
      : [xml.urlset.url];
    expect(urls).toContainEqual(
      expect.objectContaining({
        loc: "https://citeup.com/blog/2026-02-26-how-citeup-was-born",
      }),
    );
  });

  it("should include lastmod dates in YYYY-MM-DD format", () => {
    const urls = Array.isArray(xml.urlset.url)
      ? xml.urlset.url
      : [xml.urlset.url];
    for (const url of urls) {
      expect(url.lastmod).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
