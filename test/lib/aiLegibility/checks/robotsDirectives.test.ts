import { describe, expect, it } from "vitest";
import checkRobotsDirectives from "~/lib/aiLegibility/checks/robotsDirectives";

describe("checkRobotsDirectives", () => {
  it("should pass when homepage has no noindex directives", async () => {
    const result = await checkRobotsDirectives({
      pages: [
        {
          url: "https://acme.com/",
          html: "<html><head><title>Test</title></head><body>Content</body></html>",
          headers: new Headers(),
        },
      ],
    });

    expect(result.passed).toBe(true);
    expect(result.message).toContain("No noindex directives");
  });

  it("should fail when homepage has meta robots noindex", async () => {
    const result = await checkRobotsDirectives({
      pages: [
        {
          url: "https://acme.com/",
          html: '<html><head><meta name="robots" content="noindex"></head><body>Content</body></html>',
          headers: new Headers(),
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("noindex");
  });

  it("should fail when homepage has X-Robots-Tag: noindex", async () => {
    const result = await checkRobotsDirectives({
      pages: [
        {
          url: "https://acme.com/",
          html: "<html><head></head><body>Content</body></html>",
          headers: new Headers({ "X-Robots-Tag": "noindex" }),
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("X-Robots-Tag");
  });

  it("should fail when a sample page has noindex", async () => {
    const result = await checkRobotsDirectives({
      pages: [
        {
          url: "https://acme.com/",
          html: "<html><head></head><body>Content</body></html>",
          headers: new Headers(),
        },
        {
          url: "https://acme.com/blog",
          html: "<html><head></head><body>Blog</body></html>",
          headers: new Headers({ "X-Robots-Tag": "noindex" }),
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("blog");
  });

  it("should pass when multiple pages, none blocked", async () => {
    const result = await checkRobotsDirectives({
      pages: [
        {
          url: "https://acme.com/",
          html: "<html><head></head><body>Content</body></html>",
          headers: new Headers(),
        },
        {
          url: "https://acme.com/about",
          html: "<html><body>About</body></html>",
          headers: new Headers(),
        },
        {
          url: "https://acme.com/contact",
          html: "<html><body>Contact</body></html>",
          headers: new Headers(),
        },
      ],
    });

    expect(result.passed).toBe(true);
    expect(result.message).toContain("3 reviewed pages");
  });
});
