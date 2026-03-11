import { XMLParser } from "fast-xml-parser";
import { expect } from "playwright/test";
import { beforeAll, describe, it } from "vitest";
import { port } from "../helpers/launchBrowser";

describe("sitemap.xml", () => {
  let sitemapContent: string;
  let xml: { urlset: { url: { loc: string }[] } };

  beforeAll(async () => {
    const response = await fetch(`http://localhost:${port}/sitemap.xml`);
    sitemapContent = await response.text();

    const parser = new XMLParser();
    xml = parser.parse(sitemapContent);
  });

  it("should be valid XML", () => {
    expect(sitemapContent).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toHaveProperty("urlset");
    expect(xml.urlset).toHaveProperty("url");
  });

  it("should include homepage", () => {
    expect(xml.urlset.url).toContainEqual({ loc: "https://cite.me.in/" });
  });

  it("should include /faq", () => {
    expect(xml.urlset.url).toContainEqual({ loc: "https://cite.me.in/faq" });
  });

  it("should include /about", () => {
    expect(xml.urlset.url).toContainEqual({ loc: "https://cite.me.in/about" });
  });

  it("should include /blog", () => {
    expect(xml.urlset.url).toContainEqual({ loc: "https://cite.me.in/blog" });
  });

  it("should include /privacy", () => {
    expect(xml.urlset.url).toContainEqual({
      loc: "https://cite.me.in/privacy",
    });
  });

  it("should include /terms", () => {
    expect(xml.urlset.url).toContainEqual({ loc: "https://cite.me.in/terms" });
  });
});
