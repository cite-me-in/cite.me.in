import { XMLParser } from "fast-xml-parser";
import { expect } from "playwright/test";
import { beforeAll, describe, it } from "vitest";
import { port } from "../helpers/launchBrowser";

async function fetchSitemapIndex() {
  const response = await fetch(`http://localhost:${port}/sitemap.xml`);
  const sitemapContent = await response.text();
  const parser = new XMLParser();
  const xml = parser.parse(sitemapContent) as {
    sitemapindex: { sitemap: { loc: string }[] };
  };
  return { response, sitemapContent, xml };
}

async function fetchSitemapMain() {
  const response = await fetch(`http://localhost:${port}/sitemap-main.xml`);
  const sitemapContent = await response.text();
  const parser = new XMLParser();
  const xml = parser.parse(sitemapContent) as {
    urlset: { url: { loc: string }[] };
  };
  return { response, sitemapContent, xml };
}

async function fetchSitemapTxt() {
  const response = await fetch(`http://localhost:${port}/sitemap.txt`);
  const content = await response.text();
  const urls = content.split("\n").filter(Boolean);
  return { response, content, urls };
}

describe("sitemap.xml (index)", () => {
  let sitemapContent: string;
  let xml: { sitemapindex: { sitemap: { loc: string }[] } };

  beforeAll(async () => {
    ({ sitemapContent, xml } = await fetchSitemapIndex());
  });

  it("should be valid sitemap index XML", () => {
    expect(sitemapContent).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toHaveProperty("sitemapindex");
    expect(xml.sitemapindex).toHaveProperty("sitemap");
  });

  it("should reference sitemap-main.xml", () => {
    const sitemaps = Array.isArray(xml.sitemapindex.sitemap)
      ? xml.sitemapindex.sitemap
      : [xml.sitemapindex.sitemap];
    expect(sitemaps).toContainEqual({
      loc: "http://localhost:9222/sitemap-main.xml",
    });
  });

  it("should reference blog sitemap", () => {
    const sitemaps = Array.isArray(xml.sitemapindex.sitemap)
      ? xml.sitemapindex.sitemap
      : [xml.sitemapindex.sitemap];
    expect(sitemaps).toContainEqual({
      loc: "https://blog.cite.me.in/sitemap-0.xml",
    });
  });
});

describe("sitemap-main.xml", () => {
  let sitemapContent: string;
  let xml: { urlset: { url: { loc: string }[] } };

  beforeAll(async () => {
    ({ sitemapContent, xml } = await fetchSitemapMain());
  });

  it("should be valid XML", () => {
    expect(sitemapContent).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toHaveProperty("urlset");
    expect(xml.urlset).toHaveProperty("url");
  });

  it("should include homepage", () => {
    expect(xml.urlset.url).toContainEqual({ loc: "http://localhost:9222/" });
  });

  it("should include /faq", () => {
    expect(xml.urlset.url).toContainEqual({ loc: "http://localhost:9222/faq" });
  });

  it("should include /about", () => {
    expect(xml.urlset.url).toContainEqual({
      loc: "http://localhost:9222/about",
    });
  });

  it("should include /privacy", () => {
    expect(xml.urlset.url).toContainEqual({
      loc: "http://localhost:9222/privacy",
    });
  });

  it("should include /terms", () => {
    expect(xml.urlset.url).toContainEqual({
      loc: "http://localhost:9222/terms",
    });
  });
});

describe("sitemap.txt", () => {
  let response: Response;
  let urls: string[];

  beforeAll(async () => {
    ({ response, urls } = await fetchSitemapTxt());
  });

  it("should return 200", () => {
    expect(response.status).toBe(200);
  });

  it("should have text/plain content type", () => {
    expect(response.headers.get("Content-Type")).toContain("text/plain");
  });

  it("should include homepage", () => {
    expect(urls).toContain("http://localhost:9222/");
  });

  it("should include /faq", () => {
    expect(urls).toContain("http://localhost:9222/faq");
  });

  it("should include /about", () => {
    expect(urls).toContain("http://localhost:9222/about");
  });

  it("should include /privacy", () => {
    expect(urls).toContain("http://localhost:9222/privacy");
  });

  it("should include /terms", () => {
    expect(urls).toContain("http://localhost:9222/terms");
  });

  it("should include /docs", () => {
    expect(urls).toContain("http://localhost:9222/docs");
  });

  it("should include /pricing", () => {
    expect(urls).toContain("http://localhost:9222/pricing");
  });

  it("should have the same URLs as sitemap-main.xml", async () => {
    const { xml } = await fetchSitemapMain();
    const xmlUrls = (Array.isArray(xml.urlset.url)
      ? xml.urlset.url
      : [xml.urlset.url]
    ).map((u: { loc: string }) => u.loc);
    expect(urls.sort()).toEqual(xmlUrls.sort());
  });
});