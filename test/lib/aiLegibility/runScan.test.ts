import { HttpResponse, http } from "msw";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { runScan } from "~/lib/aiLegibility/runScan";
import msw from "~/test/mocks/msw";
import { failingSite, mockFetch, partialSite, passingSite } from "./fixtures";

describe("runScan", () => {
  const log = vi.fn().mockResolvedValue(undefined);
  const logs: string[] = [];

  beforeEach(() => {
    log.mockClear();
    logs.length = 0;
    log.mockImplementation(async (line: string) => {
      logs.push(line);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should run all checks in the correct order", async () => {
    vi.stubGlobal("fetch", mockFetch(passingSite()));

    const result = await runScan({ log, url: "https://acme.com" });

    const checkNames = result.checks.map((c) => c.name);
    expect(checkNames).toEqual([
      "Homepage content",
      "sitemap.xml",
      "sitemap.txt",
      "robots.txt",
      "JSON-LD",
      "Meta tags",
      "llms.txt",
      "Sample pages",
    ]);
  });

  it("should produce correct summary for passing site", async () => {
    vi.stubGlobal("fetch", mockFetch(passingSite()));

    const result = await runScan({ log, url: "https://acme.com" });

    expect(result.summary.critical.passed).toBeGreaterThan(0);
    expect(result.summary.critical.total).toBe(3);
    expect(result.summary.important.total).toBe(3);
    expect(result.summary.optimization.total).toBe(2);
  });

  it("should produce correct summary for failing site", async () => {
    vi.stubGlobal("fetch", mockFetch(failingSite()));

    const result = await runScan({ log, url: "https://acme.com" });

    expect(result.summary.critical.passed).toBe(0);
    expect(result.summary.critical.total).toBe(3);
    expect(result.summary.important.passed).toBe(0);
    expect(result.summary.optimization.passed).toBe(0);
  });

  it("should produce correct summary for partial site", async () => {
    vi.stubGlobal("fetch", mockFetch(partialSite()));

    const result = await runScan({ log, url: "https://acme.com" });

    expect(result.summary.critical.passed).toBe(2);
    expect(result.summary.critical.total).toBe(3);
    expect(result.summary.important.passed).toBe(3);
  });

  it("should normalize URL without protocol", async () => {
    vi.stubGlobal("fetch", mockFetch(passingSite()));

    const result = await runScan({ log, url: "acme.com" });

    expect(result.url).toBe("https://acme.com");
  });

  it("should normalize URL with www prefix", async () => {
    vi.stubGlobal("fetch", mockFetch(passingSite()));

    const result = await runScan({ log, url: "www.acme.com" });

    expect(result.url).toBe("https://www.acme.com");
  });

  it("should lowercase hostname", async () => {
    vi.stubGlobal("fetch", mockFetch(passingSite()));

    const result = await runScan({ log, url: "https://ACME.COM" });

    expect(result.url).toBe("https://acme.com");
  });

  it("should preserve existing https protocol", async () => {
    vi.stubGlobal("fetch", mockFetch(passingSite()));

    const result = await runScan({ log, url: "https://acme.com" });

    expect(result.url).toBe("https://acme.com");
  });

  it("should log progress messages", async () => {
    vi.stubGlobal("fetch", mockFetch(passingSite()));

    await runScan({ log, url: "https://acme.com" });

    expect(logs[0]).toContain("Scanning");
    expect(logs.some((l) => l.includes("Checking homepage content"))).toBe(
      true,
    );
    expect(logs.some((l) => l.includes("Checking sitemap.txt"))).toBe(true);
    expect(logs.some((l) => l.includes("Critical:"))).toBe(true);
    expect(logs.some((l) => l.includes("Important:"))).toBe(true);
    expect(logs.some((l) => l.includes("Optimization:"))).toBe(true);
  });

  it("should include scannedAt timestamp", async () => {
    vi.stubGlobal("fetch", mockFetch(passingSite()));

    const result = await runScan({ log, url: "https://acme.com" });

    expect(result.scannedAt).toBeDefined();
    expect(new Date(result.scannedAt).toISOString()).toBe(result.scannedAt);
  });

  it("should generate suggestions for failed checks", async () => {
    vi.stubGlobal("fetch", mockFetch(failingSite()));

    const result = await runScan({ log, url: "https://acme.com" });

    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions.some((s) => s.category === "critical")).toBe(
      true,
    );
  });

  it("should return empty suggestions when all checks pass", async () => {
    vi.stubGlobal("fetch", mockFetch(passingSite()));

    const result = await runScan({ log, url: "https://acme.com" });

    expect(result.suggestions).toEqual([]);
  });

  it("should continue running all checks even when some fail", async () => {
    vi.stubGlobal("fetch", mockFetch(failingSite()));

    const result = await runScan({ log, url: "https://acme.com" });

    expect(result.checks).toHaveLength(8);
    expect(result.checks.every((c) => c.name && c.category && c.message)).toBe(
      true,
    );
  });

  it("should categorize checks correctly", async () => {
    vi.stubGlobal("fetch", mockFetch(passingSite()));

    const result = await runScan({ log, url: "https://acme.com" });

    const criticalChecks = result.checks.filter(
      (c) => c.category === "critical",
    );
    const importantChecks = result.checks.filter(
      (c) => c.category === "important",
    );
    const optimizationChecks = result.checks.filter(
      (c) => c.category === "optimization",
    );

    expect(criticalChecks.map((c) => c.name)).toEqual(
      expect.arrayContaining([
        "Homepage content",
        "sitemap.txt",
        "sitemap.xml",
      ]),
    );
    expect(importantChecks.map((c) => c.name)).toEqual(
      expect.arrayContaining(["robots.txt", "JSON-LD"]),
    );
    expect(optimizationChecks.map((c) => c.name)).toEqual(
      expect.arrayContaining(["Meta tags", "llms.txt"]),
    );
  });
});

describe("runScan with LLM suggestions", () => {
  const log = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    log.mockClear();
  });

  afterAll(() => {
    msw.resetHandlers();
  });

  it("should return suggestions from all categories when checks fail across categories", async () => {
    msw.use(
      http.get("https://test-site.com/", () =>
        HttpResponse.html(`<!DOCTYPE html>
<html>
<head>
  <title>Test Site</title>
  <meta name="description" content="Test Site description">
</head>
<body>
  <main>
    <h1>Welcome to Test Site</h1>
    <p>We provide excellent services for businesses all around the world. Our team is dedicated to delivering quality solutions.</p>
  </main>
</body>
</html>`),
      ),
      http.get("https://test-site.com/robots.txt", () =>
        HttpResponse.text(
          "User-agent: *\nDisallow: /admin/\nSitemap: https://test-site.com/sitemap.xml",
        ),
      ),
      http.get("https://test-site.com/sitemap.xml", () =>
        HttpResponse.xml(
          `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://test-site.com/</loc></url>
</urlset>`,
          { headers: { "Content-Type": "application/xml" } },
        ),
      ),
      http.get(
        "https://test-site.com/sitemap.txt",
        () => new HttpResponse(null, { status: 404 }),
      ),
      http.get(
        "https://test-site.com/llms.txt",
        () => new HttpResponse(null, { status: 404 }),
      ),
      http.post("https://api.z.ai/api/paas/v4/chat/completions", () =>
        HttpResponse.json({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  suggestions: [
                    {
                      title: "Add sitemap.txt for AI discoverability",
                      category: "critical",
                      effort: "5 min",
                      description: "Create a sitemap.txt",
                    },
                    {
                      title: "Add JSON-LD structured data",
                      category: "important",
                      effort: "15 min",
                      description: "Add schema.org structured data",
                    },
                    {
                      title: "Add llms.txt for AI context",
                      category: "optimization",
                      effort: "5 min",
                      description: "Create an llms.txt file",
                    },
                  ],
                }),
              },
            },
          ],
        }),
      ),
    );

    const result = await runScan({ log, url: "https://test-site.com" });

    expect(result.suggestions.length).toBeGreaterThanOrEqual(3);

    const criticalSuggestions = result.suggestions.filter(
      (s) => s.category === "critical",
    );
    const importantSuggestions = result.suggestions.filter(
      (s) => s.category === "important",
    );
    const optimizationSuggestions = result.suggestions.filter(
      (s) => s.category === "optimization",
    );

    expect(criticalSuggestions.length).toBeGreaterThan(0);
    expect(importantSuggestions.length).toBeGreaterThan(0);
    expect(optimizationSuggestions.length).toBeGreaterThan(0);

    expect(criticalSuggestions[0].title).toContain("sitemap.txt");
    expect(importantSuggestions[0].title).toContain("JSON-LD");
    expect(optimizationSuggestions[0].title).toContain("llms.txt");
  });
});
