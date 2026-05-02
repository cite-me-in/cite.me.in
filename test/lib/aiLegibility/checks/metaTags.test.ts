import { describe, expect, it } from "vite-plus/test";
import checkMetaTags from "~/lib/aiLegibility/checks/metaTags";
import { HOMEPAGE_WITH_CONTENT } from "~/test/lib/aiLegibility/fixtures";

describe("checkMetaTags", () => {
  it("should pass when all 4 required OG tags are present", async () => {
    const result = await checkMetaTags({
      pages: [{ url: "https://acme.com/", html: HOMEPAGE_WITH_CONTENT }],
    });

    expect(result.passed).toBe(true);
    expect(result.name).toBe("Meta tags");
    expect(result.message).toContain("all 4 required OG tags");
    expect(result.message).toContain("description");
    expect(result.message).toContain("canonical");
  });

  it("should pass when only description is present", async () => {
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Acme Corp</title>
  <meta name="description" content="Acme Corp builds great software">
</head>
<body><main>Content</main></body>
</html>`;

    const result = await checkMetaTags({
      pages: [{ url: "https://acme.com/", html }],
    });

    expect(result.passed).toBe(true);
    expect(result.message).toContain("description");
  });

  it("should pass when all 4 OG tags are present without description", async () => {
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Acme Corp</title>
  <meta property="og:title" content="Acme Corp">
  <meta property="og:type" content="website">
  <meta property="og:image" content="https://acme.com/og.png">
  <meta property="og:url" content="https://acme.com/">
</head>
<body><main>Content</main></body>
</html>`;

    const result = await checkMetaTags({
      pages: [{ url: "https://acme.com/", html }],
    });

    expect(result.passed).toBe(true);
    expect(result.message).toContain("all 4 required OG tags");
  });

  it("should fail with partial OG tags and no fallback", async () => {
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Acme Corp</title>
  <meta property="og:title" content="Acme Corp">
  <meta property="og:description" content="We build great software">
</head>
<body><main>Content</main></body>
</html>`;

    const result = await checkMetaTags({
      pages: [{ url: "https://acme.com/", html }],
    });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("No meta description");
  });

  it("should pass when only canonical is present", async () => {
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Acme Corp</title>
  <link rel="canonical" href="https://acme.com/page">
</head>
<body><main>Content</main></body>
</html>`;

    const result = await checkMetaTags({
      pages: [{ url: "https://acme.com/", html }],
    });

    expect(result.passed).toBe(true);
    expect(result.message).toContain("canonical");
  });

  it("should fail when no meta tags are present", async () => {
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Acme Corp</title>
</head>
<body><main>Content</main></body>
</html>`;

    const result = await checkMetaTags({
      pages: [{ url: "https://acme.com/", html }],
    });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("No meta description");
    expect(result.message).toContain("Open Graph tags");
    expect(result.message).toContain("canonical URL");
  });

  it("should handle empty description content", async () => {
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Acme Corp</title>
  <meta name="description" content="">
</head>
<body><main>Content</main></body>
</html>`;

    const result = await checkMetaTags({
      pages: [{ url: "https://acme.com/", html }],
    });

    expect(result.passed).toBe(false);
  });
});
