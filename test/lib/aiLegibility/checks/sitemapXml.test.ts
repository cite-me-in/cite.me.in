import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import checkSitemapXml from "~/lib/aiLegibility/checks/sitemapXml";
import {
  CHILD_SITEMAP_1_XML,
  CHILD_SITEMAP_2_XML,
  SITEMAP_INDEX_XML,
  SITEMAP_XML,
  SITEMAP_XML_INVALID,
  mockFetch,
} from "~/test/lib/aiLegibility/fixtures";

describe("checkSitemapXml", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should pass when sitemap.xml has valid URLs", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "https://acme.com/sitemap.xml": {
          ok: true,
          status: 200,
          headers: { get: () => "application/xml" },
          text: async () => SITEMAP_XML,
        },
      }),
    );

    const result = await checkSitemapXml({ url: "https://acme.com/" });

    expect(result.passed).toBe(true);
    expect(result.name).toBe("sitemap.xml");
    expect(result.message).toContain("3 URLs");
    expect(result.urls).toHaveLength(3);
  });

  it("should fail when sitemap.xml returns 404", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "https://acme.com/sitemap.xml": {
          ok: false,
          status: 404,
          headers: { get: () => null },
          text: async () => "",
        },
      }),
    );

    const result = await checkSitemapXml({ url: "https://acme.com/" });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("not found");
    expect(result.urls).toHaveLength(0);
  });

  it("should fail when sitemap.xml has invalid XML", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "https://acme.com/sitemap.xml": {
          ok: true,
          status: 200,
          headers: { get: () => "application/xml" },
          text: async () => SITEMAP_XML_INVALID,
        },
      }),
    );

    const result = await checkSitemapXml({ url: "https://acme.com/" });
    expect(result.passed).toBe(true);
    expect(result.message).toContain("no URLs");
  });

  it("should pass when sitemap.xml is empty", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "https://acme.com/sitemap.xml": {
          ok: true,
          status: 200,
          headers: { get: () => "application/xml" },
          text: async () => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>`,
        },
      }),
    );

    const result = await checkSitemapXml({ url: "https://acme.com/" });
    expect(result.passed).toBe(true);
    expect(result.message).toContain("no URLs");
  });

  it("should resolve sitemap index and collect URLs from child sitemaps", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "https://acme.com/sitemap.xml": {
          ok: true,
          status: 200,
          headers: { get: () => "application/xml" },
          text: async () => SITEMAP_INDEX_XML,
        },
        "https://acme.com/sitemap-1.xml": {
          ok: true,
          status: 200,
          headers: { get: () => "application/xml" },
          text: async () => CHILD_SITEMAP_1_XML,
        },
        "https://acme.com/sitemap-2.xml": {
          ok: true,
          status: 200,
          headers: { get: () => "application/xml" },
          text: async () => CHILD_SITEMAP_2_XML,
        },
      }),
    );

    const result = await checkSitemapXml({ url: "https://acme.com/" });

    expect(result.passed).toBe(true);
    expect(result.message).toContain("sitemap index");
    expect(result.urls).toHaveLength(3);
    expect(result.urls).toContain("https://acme.com/page1");
    expect(result.urls).toContain("https://acme.com/page2");
    expect(result.urls).toContain("https://acme.com/page3");
  });

  it("should handle sitemap index when child sitemaps are unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "https://acme.com/sitemap.xml": {
          ok: true,
          status: 200,
          headers: { get: () => "application/xml" },
          text: async () => SITEMAP_INDEX_XML,
        },
        "https://acme.com/sitemap-1.xml": {
          ok: false,
          status: 404,
          headers: { get: () => null },
          text: async () => "",
        },
        "https://acme.com/sitemap-2.xml": {
          ok: false,
          status: 500,
          headers: { get: () => null },
          text: async () => "",
        },
      }),
    );

    const result = await checkSitemapXml({ url: "https://acme.com/" });

    expect(result.passed).toBe(true);
    expect(result.message).toContain("no child sitemaps resolved");
    expect(result.urls).toHaveLength(0);
  });

  it("should handle sitemap index with single child sitemap", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "https://acme.com/sitemap.xml": {
          ok: true,
          status: 200,
          headers: { get: () => "application/xml" },
          text: async () => `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://acme.com/sitemap-1.xml</loc></sitemap>
</sitemapindex>`,
        },
        "https://acme.com/sitemap-1.xml": {
          ok: true,
          status: 200,
          headers: { get: () => "application/xml" },
          text: async () => CHILD_SITEMAP_1_XML,
        },
      }),
    );

    const result = await checkSitemapXml({ url: "https://acme.com/" });

    expect(result.passed).toBe(true);
    expect(result.urls).toHaveLength(2);
    expect(result.urls).toContain("https://acme.com/page1");
    expect(result.urls).toContain("https://acme.com/page2");
  });
});
