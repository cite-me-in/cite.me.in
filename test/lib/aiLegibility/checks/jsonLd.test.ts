import { describe, expect, it } from "vite-plus/test";
import checkJsonLd from "~/lib/aiLegibility/checks/jsonLd";
import {
  HOMEPAGE_WITH_CONTENT,
  JSON_LD_ARTICLE,
  JSON_LD_GRAPH,
  JSON_LD_INVALID,
  JSON_LD_MULTIPLE,
  JSON_LD_PARSE_ERROR,
} from "~/test/lib/aiLegibility/fixtures";

describe("checkJsonLd", () => {
  it("should pass when a single page has valid JSON-LD Organization schema", async () => {
    const result = await checkJsonLd({
      pages: [{ url: "https://acme.com/", html: HOMEPAGE_WITH_CONTENT }],
    });

    expect(result.passed).toBe(true);
    expect(result.name).toBe("JSON-LD");
    expect(result.details?.anyPageHasValidLd).toBe(true);
  });

  it("should pass when JSON-LD Article schema is valid", async () => {
    const result = await checkJsonLd({
      pages: [{ url: "https://acme.com/blog/post", html: JSON_LD_ARTICLE }],
    });

    expect(result.passed).toBe(true);
  });

  it("should pass when multiple JSON-LD schemas are on a page", async () => {
    const result = await checkJsonLd({
      pages: [{ url: "https://acme.com/", html: JSON_LD_MULTIPLE }],
    });

    expect(result.passed).toBe(true);
    expect(result.details?.anyPageHasValidLd).toBe(true);
  });

  it("should fail when JSON-LD Article schema is missing required fields", async () => {
    const result = await checkJsonLd({
      pages: [{ url: "https://acme.com/blog/post", html: JSON_LD_INVALID }],
    });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("Missing required field");
  });

  it("should fail when page has no JSON-LD", async () => {
    const html =
      "<!DOCTYPE html><html><head><title>No JSON-LD</title></head><body><main>Content</main></body></html>";

    const result = await checkJsonLd({
      pages: [{ url: "https://acme.com/", html }],
    });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("No JSON-LD found");
    expect(result.details?.anyPageHasValidLd).toBe(false);
  });

  it("should fail when JSON-LD has parse error", async () => {
    const result = await checkJsonLd({
      pages: [{ url: "https://acme.com/", html: JSON_LD_PARSE_ERROR }],
    });

    expect(result.passed).toBe(false);
    expect(result.details?.anyPageHasValidLd).toBe(false);
  });

  it("should validate WebSite schema requires name or url", async () => {
    const html = `<!DOCTYPE html>
<html>
<head>
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"WebSite"}
  </script>
</head>
<body></body>
</html>`;

    const result = await checkJsonLd({
      pages: [{ url: "https://acme.com/", html }],
    });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("Missing required field");
  });

  it("should validate BreadcrumbList schema requires itemListElement", async () => {
    const html = `<!DOCTYPE html>
<html>
<head>
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"BreadcrumbList"}
  </script>
</head>
<body></body>
</html>`;

    const result = await checkJsonLd({
      pages: [{ url: "https://acme.com/", html }],
    });

    expect(result.passed).toBe(false);
  });

  it("should validate schemas inside @graph individually", async () => {
    const result = await checkJsonLd({
      pages: [{ url: "https://acme.com/", html: JSON_LD_GRAPH }],
    });

    expect(result.passed).toBe(true);
    expect(result.details?.anyPageHasValidLd).toBe(true);
  });

  it("should catch missing required fields inside @graph", async () => {
    const html = `<!DOCTYPE html>
<html>
<head>
  <script type="application/ld+json">
  {"@context":"https://schema.org","@graph":[{"@type":"Organization"},{"@type":"WebSite"}]}
  </script>
</head>
<body></body>
</html>`;

    const result = await checkJsonLd({
      pages: [{ url: "https://acme.com/", html }],
    });

    expect(result.passed).toBe(false);
    expect(result.details?.anyPageHasValidLd).toBe(false);
  });

  it("should fail when any reviewed page lacks JSON-LD", async () => {
    const result = await checkJsonLd({
      pages: [
        { url: "https://acme.com/", html: HOMEPAGE_WITH_CONTENT },
        {
          url: "https://acme.com/no-ld",
          html: "<html><head><title>No LD</title></head><body><p>Content</p></body></html>",
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("No JSON-LD found on https://acme.com/no-ld");
  });

  it("should fail when any reviewed page has invalid JSON-LD", async () => {
    const result = await checkJsonLd({
      pages: [
        { url: "https://acme.com/", html: HOMEPAGE_WITH_CONTENT },
        {
          url: "https://acme.com/bad-ld",
          html: `<!DOCTYPE html><html><head><script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization"}</script></head><body><p>Missing name</p></body></html>`,
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("Missing required field");
  });
});
