import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it } from "vite-plus/test";
import checkLinkHeaders from "~/lib/aiLegibility/checks/linkHeaders";
import { HOMEPAGE_WITH_CONTENT } from "~/test/lib/aiLegibility/fixtures";
import msw from "~/test/mocks/msw";

describe("checkLinkHeaders", () => {
  afterEach(() => {
    msw.resetHandlers();
  });

  it("should pass when Link header contains sitemap reference with correct RFC 8288 format", async () => {
    msw.use(
      http.head("https://acme.com/", () =>
        HttpResponse.text("", {
          headers: {
            Link: '</sitemap.xml>; rel="sitemap"',
          },
        }),
      ),
    );

    const result = await checkLinkHeaders({
      url: "https://acme.com/",
      html: "<html><head></head><body></body></html>",
    });

    expect(result.passed).toBe(true);
    expect(result.name).toBe("Sitemap link headers");
    expect(result.message).toContain("HTTP header");
    const headerLinks = result.details?.headerSitemapLinks as
      | { uri: string }[]
      | undefined;
    expect(headerLinks).toHaveLength(1);
    expect(headerLinks?.[0].uri).toBe("/sitemap.xml");
  });

  it("should parse multiple Link header entries per RFC 8288", async () => {
    msw.use(
      http.head("https://acme.com/", () =>
        HttpResponse.text("", {
          headers: {
            Link: '</sitemap.xml>; rel="sitemap", </sitemap.txt>; rel="sitemap"',
          },
        }),
      ),
    );

    const result = await checkLinkHeaders({
      url: "https://acme.com/",
      html: "<html></html>",
    });

    expect(result.passed).toBe(true);
    const headerLinks = result.details?.headerSitemapLinks as
      | { uri: string }[]
      | undefined;
    expect(headerLinks).toHaveLength(2);
  });

  it("should pass when HTML has sitemap link tag", async () => {
    msw.use(
      http.head("https://acme.com/", () =>
        HttpResponse.text("", { headers: {} }),
      ),
    );

    const result = await checkLinkHeaders({
      url: "https://acme.com/",
      html: '<html><head><link rel="sitemap" type="application/xml" href="/sitemap.xml"></head><body></body></html>',
    });

    expect(result.passed).toBe(true);
    expect(result.message).toContain("HTML <link>");
  });

  it("should pass when both Link header and HTML link tag exist", async () => {
    msw.use(
      http.head("https://acme.com/", () =>
        HttpResponse.text("", {
          headers: {
            Link: '</sitemap.xml>; rel="sitemap"',
          },
        }),
      ),
    );

    const result = await checkLinkHeaders({
      url: "https://acme.com/",
      html: '<html><head><link rel="sitemap" type="application/xml" href="/sitemap.xml"></head><body></body></html>',
    });

    expect(result.passed).toBe(true);
    expect(result.message).toContain("HTTP header");
    expect(result.message).toContain("HTML <link>");
  });

  it("should report when Link header exists but has no sitemap rel", async () => {
    msw.use(
      http.head("https://acme.com/", () =>
        HttpResponse.text("", {
          headers: {
            Link: '</style.css>; rel="stylesheet", </script.js>; rel="preload"',
          },
        }),
      ),
    );

    const result = await checkLinkHeaders({
      url: "https://acme.com/",
      html: "<html></html>",
    });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("no rel='sitemap'");
  });

  it("should fail when no sitemap reference exists", async () => {
    msw.use(
      http.head("https://acme.com/", () =>
        HttpResponse.text("", { headers: {} }),
      ),
    );

    const result = await checkLinkHeaders({
      url: "https://acme.com/",
      html: HOMEPAGE_WITH_CONTENT,
    });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("No sitemap reference");
  });

  it("should handle network errors", async () => {
    msw.use(http.head("https://acme.com/", () => HttpResponse.error()));

    const result = await checkLinkHeaders({
      url: "https://acme.com/",
      html: "<html></html>",
    });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("Failed to check");
  });
});
