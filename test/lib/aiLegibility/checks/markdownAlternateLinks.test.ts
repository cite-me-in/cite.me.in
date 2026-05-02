import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it } from "vite-plus/test";
import checkMarkdownAlternateLinks from "~/lib/aiLegibility/checks/markdownAlternateLinks";
import msw from "~/test/mocks/msw";

describe("checkMarkdownAlternateLinks", () => {
  afterEach(() => {
    msw.resetHandlers();
  });

  it("should pass when homepage has Link header with text/markdown", async () => {
    msw.use(
      http.head("https://acme.com/", () =>
        HttpResponse.text("", {
          headers: {
            Link: '</index.md>; rel="alternate"; type="text/markdown"',
          },
        }),
      ),
    );

    const result = await checkMarkdownAlternateLinks({
      url: "https://acme.com/",
      html: "<html><head></head><body></body></html>",
    });

    expect(result.passed).toBe(true);
    expect(result.message).toContain("Link header");
    expect(result.details?.homepageFound).toBe(true);
    expect(result.details?.homepageFromHeader).toBe(true);
    expect(result.details?.alternateUrls).toContain(
      "https://acme.com/index.md",
    );
  });

  it("should pass when homepage has HTML <link> tag for markdown", async () => {
    msw.use(http.head("https://acme.com/", () => HttpResponse.text("", {})));

    const result = await checkMarkdownAlternateLinks({
      url: "https://acme.com/",
      html: '<html><head><link rel="alternate" type="text/markdown" href="/index.md"></head><body></body></html>',
    });

    expect(result.passed).toBe(true);
    expect(result.message).toContain("HTML <link> tag");
    expect(result.details?.homepageFromHtml).toBe(true);
    expect(result.details?.alternateUrls).toContain(
      "https://acme.com/index.md",
    );
  });

  it("should pass when homepage fails to fetch but HTML has markdown link", async () => {
    msw.use(http.head("https://acme.com/", () => HttpResponse.error()));

    const result = await checkMarkdownAlternateLinks({
      url: "https://acme.com/",
      html: '<html><head><link rel="alternate" type="text/markdown" href="/index.md"></head><body></body></html>',
    });

    expect(result.passed).toBe(true);
    expect(result.details?.homepageFromHtml).toBe(true);
    expect(result.details?.homepageFromHeader).toBe(false);
  });

  it("should pass when sample page has markdown alternate but homepage doesn't", async () => {
    msw.use(
      http.head("https://acme.com/", () => HttpResponse.text("", {})),
      http.head("https://acme.com/about", () =>
        HttpResponse.text("", {
          headers: {
            Link: '</about.md>; rel="alternate"; type="text/markdown"',
          },
        }),
      ),
    );

    const result = await checkMarkdownAlternateLinks({
      url: "https://acme.com/",
      html: "<html><head></head><body></body></html>",
      pages: [
        {
          url: "https://acme.com/about",
          html: "<html><head></head><body>About</body></html>",
        },
      ],
    });

    expect(result.passed).toBe(true);
    expect(result.details?.pagesWithLink).toBe(1);
    expect(result.details?.homepageFound).toBe(false);
  });

  it("should pass when some sample pages have markdown alternate", async () => {
    msw.use(
      http.head("https://acme.com/", () => HttpResponse.text("", {})),
      http.head("https://acme.com/about", () =>
        HttpResponse.text("", {
          headers: {
            Link: '</about.md>; rel="alternate"; type="text/markdown"',
          },
        }),
      ),
      http.head("https://acme.com/contact", () => HttpResponse.text("", {})),
    );

    const result = await checkMarkdownAlternateLinks({
      url: "https://acme.com/",
      html: "<html><head></head><body></body></html>",
      pages: [
        {
          url: "https://acme.com/about",
          html: "<html><head></head><body>About</body></html>",
        },
        {
          url: "https://acme.com/contact",
          html: "<html><head></head><body>Contact</body></html>",
        },
      ],
    });

    expect(result.passed).toBe(true);
    expect(result.details?.pagesWithLink).toBe(1);
    expect(result.details?.pagesChecked).toBe(2);
  });

  it("should fail when no page has markdown alternate", async () => {
    msw.use(
      http.head("https://acme.com/", () => HttpResponse.text("", {})),
      http.head("https://acme.com/about", () => HttpResponse.text("", {})),
    );

    const result = await checkMarkdownAlternateLinks({
      url: "https://acme.com/",
      html: "<html><head></head><body></body></html>",
      pages: [
        {
          url: "https://acme.com/about",
          html: "<html><head></head><body>About</body></html>",
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("No <link rel='alternate'");
  });

  it("should handle sample page without html field gracefully", async () => {
    msw.use(
      http.head("https://acme.com/", () =>
        HttpResponse.text("", {
          headers: {
            Link: '</index.md>; rel="alternate"; type="text/markdown"',
          },
        }),
      ),
    );

    const result = await checkMarkdownAlternateLinks({
      url: "https://acme.com/",
      html: "<html><head></head><body></body></html>",
      pages: [{ url: "https://acme.com/unreachable" }],
    });

    expect(result.passed).toBe(true);
    expect(result.details?.pagesWithLink).toBe(0);
  });
});
