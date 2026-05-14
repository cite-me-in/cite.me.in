import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import checkSitemapTxt from "~/lib/aiLegibility/checks/sitemapTxt";
import { SITEMAP_TXT, SITEMAP_TXT_INVALID, mockFetch } from "~/test/lib/aiLegibility/fixtures";

describe("checkSitemapTxt", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should pass when sitemap.txt has valid URLs", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "https://acme.com/sitemap.txt": {
          ok: true,
          status: 200,
          headers: { get: () => "text/plain" },
          text: async () => SITEMAP_TXT,
        },
      }),
    );

    const result = await checkSitemapTxt({ url: "https://acme.com/" });

    expect(result.passed).toBe(true);
    expect(result.name).toBe("sitemap.txt");
    expect(result.message).toContain("4 valid URLs");
    expect(result.urls).toHaveLength(4);
  });

  it("should fail when sitemap.txt returns 404", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "https://acme.com/sitemap.txt": {
          ok: false,
          status: 404,
          headers: { get: () => null },
          text: async () => "",
        },
      }),
    );

    const result = await checkSitemapTxt({ url: "https://acme.com/" });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("not found");
    expect(result.urls).toHaveLength(0);
  });

  it("should fail when sitemap.txt has no valid URLs", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "https://acme.com/sitemap.txt": {
          ok: true,
          status: 200,
          headers: { get: () => "text/plain" },
          text: async () => SITEMAP_TXT_INVALID,
        },
      }),
    );

    const result = await checkSitemapTxt({ url: "https://acme.com/" });

    expect(result.passed).toBe(true);
    expect(result.message).toContain("no valid URLs");
    expect(result.urls).toHaveLength(0);
  });

  it("should pass with warning when sitemap.txt has some invalid lines", async () => {
    const mixedContent = `https://acme.com/
Not a URL
https://acme.com/about
Also not a URL`;

    vi.stubGlobal(
      "fetch",
      mockFetch({
        "https://acme.com/sitemap.txt": {
          ok: true,
          status: 200,
          headers: { get: () => "text/plain" },
          text: async () => mixedContent,
        },
      }),
    );

    const result = await checkSitemapTxt({ url: "https://acme.com/" });

    expect(result.passed).toBe(true);
    expect(result.message).toContain("2 URLs");
    expect(result.message).toContain("2 invalid lines");
    expect(result.urls).toHaveLength(2);
  });

  it("should handle network errors", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("ECONNREFUSED");
    });

    const result = await checkSitemapTxt({ url: "https://acme.com/" });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("Failed to fetch");
  });
});
