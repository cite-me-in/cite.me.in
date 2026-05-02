import { describe, expect, it } from "vite-plus/test";
import checkMarkdownAlternateLinks from "~/lib/aiLegibility/checks/markdownAlternateLinks";

describe("checkMarkdownAlternateLinks", () => {
  it("should pass when a page has Link header with text/markdown", async () => {
    const result = await checkMarkdownAlternateLinks({
      pages: [
        {
          url: "https://acme.com/",
          html: "<html><head></head><body></body></html>",
          headers: {
            Link: '</index.md>; rel="alternate"; type="text/markdown"',
          },
        },
      ],
    });

    expect(result.passed).toBe(true);
    expect(result.message).toContain("Link header");
    expect(result.details?.alternateUrls).toContain(
      "https://acme.com/index.md",
    );
  });

  it("should pass when a page has HTML <link> tag for markdown", async () => {
    const result = await checkMarkdownAlternateLinks({
      pages: [
        {
          url: "https://acme.com/",
          html: '<html><head><link rel="alternate" type="text/markdown" href="/index.md"></head><body></body></html>',
        },
      ],
    });

    expect(result.passed).toBe(true);
    expect(result.message).toContain("HTML <link> tag");
    expect(result.details?.alternateUrls).toContain(
      "https://acme.com/index.md",
    );
  });

  it("should pass when sample page has markdown alternate but homepage doesn't", async () => {
    const result = await checkMarkdownAlternateLinks({
      pages: [
        {
          url: "https://acme.com/",
          html: "<html><head></head><body></body></html>",
        },
        {
          url: "https://acme.com/about",
          html: "<html><head></head><body>About</body></html>",
          headers: {
            Link: '</about.md>; rel="alternate"; type="text/markdown"',
          },
        },
      ],
    });

    expect(result.passed).toBe(true);
    expect(result.details?.pagesWithLink).toBe(1);
  });

  it("should pass when some sample pages have markdown alternate", async () => {
    const result = await checkMarkdownAlternateLinks({
      pages: [
        {
          url: "https://acme.com/",
          html: "<html><head></head><body></body></html>",
        },
        {
          url: "https://acme.com/about",
          html: "<html><head></head><body>About</body></html>",
          headers: {
            Link: '</about.md>; rel="alternate"; type="text/markdown"',
          },
        },
        {
          url: "https://acme.com/contact",
          html: "<html><head></head><body>Contact</body></html>",
        },
      ],
    });

    expect(result.passed).toBe(true);
    expect(result.details?.pagesWithLink).toBe(1);
    expect(result.details?.pagesChecked).toBe(3);
  });

  it("should fail when no page has markdown alternate", async () => {
    const result = await checkMarkdownAlternateLinks({
      pages: [
        {
          url: "https://acme.com/",
          html: "<html><head></head><body></body></html>",
        },
        {
          url: "https://acme.com/about",
          html: "<html><head></head><body>About</body></html>",
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("No <link rel='alternate'");
  });
});
