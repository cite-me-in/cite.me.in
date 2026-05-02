import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it } from "vite-plus/test";
import checkRobotsDirectives from "~/lib/aiLegibility/checks/robotsDirectives";
import msw from "~/test/mocks/msw";

describe("checkRobotsDirectives", () => {
  afterEach(() => {
    msw.resetHandlers();
  });

  it("should pass when homepage has no noindex directives", async () => {
    const result = await checkRobotsDirectives({
      url: "https://acme.com/",
      html: "<html><head><title>Test</title></head><body>Content</body></html>",
    });

    expect(result.passed).toBe(true);
    expect(result.message).toContain("No noindex directives");
  });

  it("should fail when homepage has meta robots noindex", async () => {
    const result = await checkRobotsDirectives({
      url: "https://acme.com/",
      html: '<html><head><meta name="robots" content="noindex"></head><body>Content</body></html>',
    });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("noindex");
    expect(result.message).toContain("Homepage");
  });

  it("should fail when homepage has X-Robots-Tag: noindex", async () => {
    msw.use(
      http.head("https://acme.com/", () =>
        HttpResponse.text("", {
          headers: { "X-Robots-Tag": "noindex" },
        }),
      ),
    );

    const result = await checkRobotsDirectives({
      url: "https://acme.com/",
      html: "<html><head></head><body>Content</body></html>",
    });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("X-Robots-Tag");
  });

  it("should fail when a sample page has noindex", async () => {
    msw.use(
      http.head("https://acme.com/", () => HttpResponse.text("", {})),
      http.head("https://acme.com/blog", () =>
        HttpResponse.text("", {
          headers: { "X-Robots-Tag": "noindex" },
        }),
      ),
    );

    const result = await checkRobotsDirectives({
      url: "https://acme.com/",
      html: "<html><head></head><body>Content</body></html>",
      pages: [
        {
          url: "https://acme.com/blog",
          html: "<html><head></head><body>Blog</body></html>",
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("blog");
  });

  it("should pass when sample pages have no html field (unfetchable)", async () => {
    const result = await checkRobotsDirectives({
      url: "https://acme.com/",
      html: "<html><head></head><body>Content</body></html>",
      pages: [{ url: "https://acme.com/unreachable" }],
    });

    expect(result.passed).toBe(true);
  });

  it("should pass with multiple pages, none blocked", async () => {
    const result = await checkRobotsDirectives({
      url: "https://acme.com/",
      html: "<html><head></head><body>Content</body></html>",
      pages: [
        {
          url: "https://acme.com/about",
          html: "<html><body>About</body></html>",
        },
        {
          url: "https://acme.com/contact",
          html: "<html><body>Contact</body></html>",
        },
      ],
    });

    expect(result.passed).toBe(true);
    expect(result.message).toContain("2 sample pages");
  });

  it("should handle fetch failure gracefully", async () => {
    msw.use(http.head("https://acme.com/", () => HttpResponse.error()));

    const result = await checkRobotsDirectives({
      url: "https://acme.com/",
      html: "<html><head></head><body>Content</body></html>",
    });

    expect(result.passed).toBe(true);
  });
});
