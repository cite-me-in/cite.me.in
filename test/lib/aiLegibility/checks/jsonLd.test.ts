import { describe, expect, it } from "vite-plus/test";
import checkJsonLd, {
  extractSchemas,
  flattenNodes,
  validateSchema,
} from "~/lib/aiLegibility/checks/jsonLd";
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

describe("validateSchema", () => {
  it("returns null for NewsArticle with headline", () => {
    expect(validateSchema("NewsArticle", { headline: "Breaking News" })).toBeNull();
  });

  it("returns error for NewsArticle missing headline/name", () => {
    expect(validateSchema("NewsArticle", {})).toBe(
      "Missing required field 'headline' or 'name' in Article, NewsArticle, or BlogPosting schemas",
    );
  });

  it("returns null for BlogPosting with name", () => {
    expect(validateSchema("BlogPosting", { name: "Post Title" })).toBeNull();
  });

  it("returns error for BlogPosting missing headline/name", () => {
    expect(validateSchema("BlogPosting", {})).toBe(
      "Missing required field 'headline' or 'name' in Article, NewsArticle, or BlogPosting schemas",
    );
  });

  it("returns error for Organization missing name", () => {
    expect(validateSchema("Organization", {})).toBe("Missing required field 'name' in Organization schema");
  });

  it("returns null for Organization with name", () => {
    expect(validateSchema("Organization", { name: "Acme" })).toBeNull();
  });

  it("returns error for WebSite missing both name and url", () => {
    expect(validateSchema("WebSite", {})).toBe("Missing required field 'name' or 'url' in WebSite schema");
  });

  it("returns null for WebSite with name only", () => {
    expect(validateSchema("WebSite", { name: "Acme Site" })).toBeNull();
  });

  it("returns null for WebSite with url only", () => {
    expect(validateSchema("WebSite", { url: "https://acme.com" })).toBeNull();
  });

  it("returns error for BreadcrumbList missing both itemListElement and itemList", () => {
    expect(validateSchema("BreadcrumbList", {})).toBe(
      "Missing required field 'itemListElement' or 'itemList' in BreadcrumbList schema",
    );
  });

  it("returns null for BreadcrumbList with itemListElement", () => {
    expect(validateSchema("BreadcrumbList", { itemListElement: [] })).toBeNull();
  });

  it("returns null for BreadcrumbList with itemList (alternative field)", () => {
    expect(validateSchema("BreadcrumbList", { itemList: [] })).toBeNull();
  });

  it("returns error for Product missing name", () => {
    expect(validateSchema("Product", {})).toBe("Missing required field 'name' in Product schema");
  });

  it("returns null for Product with name", () => {
    expect(validateSchema("Product", { name: "Widget" })).toBeNull();
  });

  it("returns error for Person missing name", () => {
    expect(validateSchema("Person", {})).toBe("Missing required field 'name' in Person schema");
  });

  it("returns null for Person with name", () => {
    expect(validateSchema("Person", { name: "John" })).toBeNull();
  });

  it("returns error for FAQPage missing mainEntity", () => {
    expect(validateSchema("FAQPage", {})).toBe("Missing required field 'mainEntity' in FAQPage schema");
  });

  it("returns null for FAQPage with mainEntity", () => {
    expect(validateSchema("FAQPage", { mainEntity: [] })).toBeNull();
  });

  it("returns error for HowTo missing name", () => {
    expect(validateSchema("HowTo", {})).toBe("Missing required field 'name' in HowTo schema");
  });

  it("returns null for HowTo with name", () => {
    expect(validateSchema("HowTo", { name: "Steps" })).toBeNull();
  });

  it("returns error for LocalBusiness missing name", () => {
    expect(validateSchema("LocalBusiness", {})).toBe("Missing required field 'name' in LocalBusiness schema");
  });

  it("returns null for LocalBusiness with name", () => {
    expect(validateSchema("LocalBusiness", { name: "Shop" })).toBeNull();
  });

  it("returns error for SoftwareApplication missing name", () => {
    expect(validateSchema("SoftwareApplication", {})).toBe(
      "Missing required field 'name' in SoftwareApplication schema",
    );
  });

  it("returns null for SoftwareApplication with name", () => {
    expect(validateSchema("SoftwareApplication", { name: "App" })).toBeNull();
  });

  it("returns null for unknown schema type", () => {
    expect(validateSchema("UnknownType", { name: "test" })).toBeNull();
  });

  it("returns null for Article with headline", () => {
    expect(validateSchema("Article", { headline: "Article Title" })).toBeNull();
  });

  it("returns error for Article missing headline/name", () => {
    expect(validateSchema("Article", {})).toBe(
      "Missing required field 'headline' or 'name' in Article, NewsArticle, or BlogPosting schemas",
    );
  });
});

describe("extractSchemas", () => {
  it("returns empty array for empty script tag", () => {
    const html = `<html><head><script type="application/ld+json"></script></head><body></body></html>`;
    const result = extractSchemas(html);
    expect(result).toEqual([]);
  });

  it("returns valid schema for unknown @type", () => {
    const html = `<html><head><script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage"}</script></head><body></body></html>`;
    const result = extractSchemas(html);
    expect(result).toEqual([{ type: "WebPage", valid: true }]);
  });

  it("returns valid schema when @type is an array", () => {
    const html = `<html><head><script type="application/ld+json">{"@context":"https://schema.org","@type":["Article","WebPage"]}</script></head><body></body></html>`;
    const result = extractSchemas(html);
    expect(result).toEqual([{ type: "unknown", valid: true }]);
  });

  it("returns empty array when @type is missing (flattenNodes filters it out)", () => {
    const html = `<html><head><script type="application/ld+json">{"@context":"https://schema.org","name":"test"}</script></head><body></body></html>`;
    const result = extractSchemas(html);
    expect(result).toEqual([]);
  });

  it("returns invalid schema for JSON parse error", () => {
    const html = `<html><head><script type="application/ld+json">{invalid}</script></head><body></body></html>`;
    const result = extractSchemas(html);
    expect(result).toHaveLength(1);
    expect(result[0].valid).toBe(false);
    expect(result[0].error).toContain("JSON parse error");
  });

  it("handles mixed valid and invalid schemas across multiple script tags", () => {
    const html = `<html><head>
      <script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Acme"}</script>
      <script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization"}</script>
    </head><body></body></html>`;
    const result = extractSchemas(html);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ type: "Organization", valid: true });
    expect(result[1].valid).toBe(false);
    expect(result[1].error).toContain("Missing required field");
  });
});

describe("flattenNodes", () => {
  it("returns empty array for null input", () => {
    expect(flattenNodes(null)).toEqual([]);
  });

  it("returns empty array for undefined input", () => {
    expect(flattenNodes(undefined)).toEqual([]);
  });

  it("returns empty array for string input", () => {
    expect(flattenNodes("hello")).toEqual([]);
  });

  it("flattens array of objects", () => {
    const data = [{ "@type": "Organization", name: "Acme" }, { "@type": "WebSite", url: "https://acme.com" }];
    const result = flattenNodes(data);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ "@type": "Organization", name: "Acme" });
    expect(result[1]).toEqual({ "@type": "WebSite", url: "https://acme.com" });
  });

  it("returns @graph nodes when @graph is an array", () => {
    const data = {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "Organization", name: "Acme" },
        { "@type": "WebSite", url: "https://acme.com" },
      ],
    };
    const result = flattenNodes(data);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ "@type": "Organization", name: "Acme" });
    expect(result[1]).toEqual({ "@type": "WebSite", url: "https://acme.com" });
  });

  it("ignores @graph when it is not an array, falls through to @type", () => {
    const data = { "@graph": "not-an-array", "@type": "Organization", name: "Acme" };
    const result = flattenNodes(data);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ "@graph": "not-an-array", "@type": "Organization", name: "Acme" });
  });

  it("returns empty array when @graph is not an array and no @type", () => {
    const data = { "@graph": "not-an-array", name: "Acme" };
    const result = flattenNodes(data);
    expect(result).toEqual([]);
  });

  it("prefers @graph over @type when both are present", () => {
    const data = {
      "@type": "IgnoreMe",
      "@graph": [{ "@type": "Organization", name: "Acme" }],
    };
    const result = flattenNodes(data);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ "@type": "Organization", name: "Acme" });
  });

  it("returns empty array for object with no @graph and no @type", () => {
    const data = { name: "test", url: "https://test.com" };
    const result = flattenNodes(data);
    expect(result).toEqual([]);
  });

  it("handles nested arrays via flatMap", () => {
    const data = [
      [{ "@type": "Organization", name: "Acme" }],
      { "@type": "WebSite", url: "https://acme.com" },
    ];
    const result = flattenNodes(data);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ "@type": "Organization", name: "Acme" });
    expect(result[1]).toEqual({ "@type": "WebSite", url: "https://acme.com" });
  });
});
