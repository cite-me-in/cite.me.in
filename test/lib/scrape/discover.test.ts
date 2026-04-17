import { describe, expect, it, vi } from "vitest";
import discoverURLs from "~/lib/scrape/discover";
import {
  HOMEPAGE_HTML,
  RSS_FEED,
  llmsTxtSite,
  mockFetch,
  navOnlySite,
  sitemapTxtSite,
  sitemapXmlSite,
} from "./fixtures";

describe("discoverUrls", () => {
  it("should put llms.txt URLs first in the queue", async () => {
    vi.stubGlobal("fetch", mockFetch(llmsTxtSite()));
    const urls = await discoverURLs({
      url: new URL("https://acme.com"),
      homepage: HOMEPAGE_HTML,
      signal: AbortSignal.timeout(5000),
    });
    expect(urls.map((url) => url.href)).toContain("https://acme.com/about");
    expect(urls.map((url) => url.href)).toContain("https://acme.com/pricing");
  });

  it("should filter URLs matching robots.txt Disallow rules", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        ...llmsTxtSite(),
        "https://acme.com/llms.txt": {
          ok: true,
          status: 200,
          headers: {
            get: (h: string) => (h === "content-type" ? "text/plain" : null),
          },
          text: async () =>
            "https://acme.com/about\nhttps://acme.com/admin/secret\n",
        },
      }),
    );
    const urls = await discoverURLs({
      url: new URL("https://acme.com"),
      homepage: HOMEPAGE_HTML,
      signal: AbortSignal.timeout(5000),
    });
    expect(urls.map((url) => url.href)).toContain("https://acme.com/about");
    expect(urls.map((url) => url.href)).not.toContain(
      "https://acme.com/admin/secret",
    );
  });

  it("should use sitemap.txt when available (not sitemap.xml)", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        ...sitemapTxtSite(),
        "https://acme.com/sitemap.xml": {
          ok: true,
          status: 200,
          headers: {
            get: (h: string) =>
              h === "content-type" ? "application/xml" : null,
          },
          text: async () =>
            "<urlset><url><loc>https://acme.com/xml-only-page</loc></url></urlset>",
        },
      }),
    );
    const urls = await discoverURLs({
      url: new URL("https://acme.com"),
      homepage: HOMEPAGE_HTML,
      signal: AbortSignal.timeout(5000),
    });
    expect(urls.map((url) => url.href)).toContain("https://acme.com/about");
    expect(urls.map((url) => url.href)).not.toContain(
      "https://acme.com/xml-only-page",
    );
  });

  it("should fall back to sitemap.xml when no sitemap.txt exists", async () => {
    vi.stubGlobal("fetch", mockFetch(sitemapXmlSite()));
    const urls = await discoverURLs({
      url: new URL("https://acme.com"),
      homepage: HOMEPAGE_HTML.replace(
        'href="/sitemap.txt"',
        'href="/sitemap.xml"',
      ),
      signal: AbortSignal.timeout(5000),
    });
    expect(urls.map((url) => url.href)).toContain("https://acme.com/about");
    expect(urls.map((url) => url.href)).toContain("https://acme.com/pricing");
  });

  it("should fall back to nav links when no sitemap exists", async () => {
    const site = navOnlySite();
    vi.stubGlobal("fetch", mockFetch(site));
    const urls = await discoverURLs({
      url: new URL("https://acme.com"),
      homepage: HOMEPAGE_HTML.replace(
        '<link rel="sitemap" href="/sitemap.txt" />',
        "",
      ).replace(
        '<link rel="alternate" type="application/rss+xml" href="/feed.xml" />',
        "",
      ),
      signal: AbortSignal.timeout(5000),
    });
    expect(urls.map((url) => url.href)).toContain("https://acme.com/about");
    expect(urls.map((url) => url.href)).toContain("https://acme.com/pricing");
  });

  it("should extract URLs from RSS feed link in homepage head", async () => {
    const notFound = {
      ok: false,
      status: 404,
      headers: { get: () => null } as { get: (name: string) => string | null },
      text: async () => "",
    };
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "https://acme.com/llms.txt": notFound,
        "https://acme.com/robots.txt": notFound,
        "https://acme.com/sitemap.txt": notFound,
        "https://acme.com/sitemap.xml": notFound,
        "https://acme.com/feed.xml": {
          ok: true,
          status: 200,
          headers: {
            get: (h: string) =>
              h === "content-type" ? "application/rss+xml" : null,
          },
          text: async () => RSS_FEED,
        },
      }),
    );
    const urls = await discoverURLs({
      url: new URL("https://acme.com"),
      homepage: HOMEPAGE_HTML,
      signal: AbortSignal.timeout(5000),
    });
    expect(urls.map((url) => url.href)).toContain(
      "https://acme.com/blog/post-1",
    );
    expect(urls.map((url) => url.href)).toContain(
      "https://acme.com/blog/post-2",
    );
  });
});
