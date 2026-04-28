import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import checkSitemapXml from "~/lib/aiLegibility/checks/sitemapXml";
import {
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
    expect(result.category).toBe("discoverability");
    expect(result.message).toContain("3 URLs");
    expect(result.urls).toHaveLength(3);
  });

  it("should pass with text/xml MIME type", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "https://acme.com/sitemap.xml": {
          ok: true,
          status: 200,
          headers: { get: () => "text/xml" },
          text: async () => SITEMAP_XML,
        },
      }),
    );

    const result = await checkSitemapXml({ url: "https://acme.com/" });

    expect(result.passed).toBe(true);
    expect(result.message).toContain("text/xml");
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

  it("should fail when sitemap.xml has incorrect MIME type", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "https://acme.com/sitemap.xml": {
          ok: true,
          status: 200,
          headers: { get: () => "text/html" },
          text: async () => SITEMAP_XML,
        },
      }),
    );

    const result = await checkSitemapXml({ url: "https://acme.com/" });
    expect(result.passed).toBe(false);
    expect(result.message).toContain("incorrect MIME type");
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
});
