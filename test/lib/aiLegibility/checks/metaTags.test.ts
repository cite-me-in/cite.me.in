import { beforeEach, describe, expect, it, vi } from "vitest";
import checkMetaTags from "~/lib/aiLegibility/checks/metaTags";
import { HOMEPAGE_WITH_CONTENT } from "../fixtures";

describe("checkMetaTags", () => {
  const log = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    log.mockClear();
  });

  it("should pass when all meta tags are present", async () => {
    const result = await checkMetaTags({
      url: "https://acme.com/",
      html: HOMEPAGE_WITH_CONTENT,
      log,
    });

    expect(result.passed).toBe(true);
    expect(result.name).toBe("Meta tags");
    expect(result.category).toBe("optimization");
    expect(result.message).toContain("description");
    expect(result.message).toContain("Open Graph");
    expect(result.message).toContain("canonical");
    expect(result.description).toBe("Acme Corp builds great software");
    expect(result.ogTitle).toBe("Acme Corp");
    expect(result.canonical).toBe("https://acme.com/");
    expect(log).toHaveBeenCalledWith(expect.stringContaining("✓"));
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
      url: "https://acme.com/",
      html,
      log,
    });

    expect(result.passed).toBe(true);
    expect(result.message).toContain("description");
    expect(result.description).toBe("Acme Corp builds great software");
  });

  it("should pass when only Open Graph tags are present", async () => {
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
      url: "https://acme.com/",
      html,
      log,
    });

    expect(result.passed).toBe(true);
    expect(result.message).toContain("Open Graph");
    expect(result.ogTitle).toBe("Acme Corp");
    expect(result.ogDescription).toBe("We build great software");
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
      url: "https://acme.com/",
      html,
      log,
    });

    expect(result.passed).toBe(true);
    expect(result.message).toContain("canonical");
    expect(result.canonical).toBe("https://acme.com/page");
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
      url: "https://acme.com/",
      html,
      log,
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
      url: "https://acme.com/",
      html,
      log,
    });

    expect(result.passed).toBe(false);
  });
});
