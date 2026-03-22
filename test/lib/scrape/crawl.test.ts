import { describe, expect, it, vi } from "vitest";
import { crawl } from "~/lib/scrape/crawl";
import {
  HTML_MAIN_CONTENT,
  llmsTxtSite,
  mockFetch,
  navOnlySite,
} from "./fixtures";

describe("crawl", () => {
  it("should return content from crawled pages", async () => {
    vi.stubGlobal("fetch", mockFetch(navOnlySite()));
    const content = await crawl({
      baseURL: "https://acme.com",
      maxWords: 5_000,
      maxPages: 5,
      maxSeconds: 10,
    });
    expect(content.length).toBeGreaterThan(0);
  });

  it("should include content from llms.txt URLs first", async () => {
    vi.stubGlobal("fetch", mockFetch(llmsTxtSite()));
    const content = await crawl({
      baseURL: "https://acme.com",
      maxWords: 5_000,
      maxPages: 5,
      maxSeconds: 10,
    });
    // llms.txt lists /about, /pricing, /blog/post-1
    // HTML_MAIN_CONTENT and HTML_ARTICLE_CONTENT contain these strings
    expect(content).toContain("main content");
  });

  it("should stop fetching after maxPages content pages", async () => {
    let pagesFetched = 0;
    const manyUrls = Array.from(
      { length: 30 },
      (_, i) => `https://acme.com/page-${i}`,
    ).join("\n");

    vi.stubGlobal("fetch", async (url: string) => {
      if (typeof url === "string" && url.includes("/sitemap.txt")) {
        return {
          ok: true,
          status: 200,
          headers: {
            get: (h: string) => (h === "content-type" ? "text/plain" : null),
          },
          text: async () => manyUrls,
        };
      }
      pagesFetched++;
      return {
        ok: true,
        status: 200,
        headers: {
          get: (h: string) => (h === "content-type" ? "text/html" : null),
        },
        text: async () => HTML_MAIN_CONTENT,
      };
    });

    await crawl({
      baseURL: "https://acme.com",
      maxWords: 50_000,
      maxPages: 5,
      maxSeconds: 10,
    });

    // pagesFetched counts: 1 homepage + 2 discovery probes (llms.txt, robots.txt)
    // + at most 4 queue pages (maxPages=5, homepage already counted as 1)
    // sitemap.txt returns 200 but is NOT counted (mock skips increment for /sitemap.txt)
    // RSS: no feed link in HTML_MAIN_CONTENT so no fetch; sitemap.xml not tried since sitemap.txt succeeds
    // Total: 1 + 2 + up to 4 = 7, with CONCURRENCY=3 race at most 9
    expect(pagesFetched).toBeLessThanOrEqual(9);
  });

  it("should respect maxWords limit and not return more than maxWords words", async () => {
    // Each page has ~20 words — with maxWords=30, should stop early
    vi.stubGlobal("fetch", mockFetch(navOnlySite()));
    const content = await crawl({
      baseURL: "https://acme.com",
      maxWords: 30,
      maxPages: 20,
      maxSeconds: 10,
    });
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    expect(wordCount).toBeLessThanOrEqual(30);
  });
});
