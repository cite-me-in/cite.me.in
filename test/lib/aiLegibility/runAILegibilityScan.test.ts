import { HttpResponse, http } from "msw";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import runAILegibilityScan from "~/lib/aiLegibility/runAILegibilityScan";
import msw from "~/test/mocks/msw";
import { failingSite, partialSite, passingSite } from "./fixtures";

const mockAppendLog = vi.fn();
const mockGetProgress = vi.fn();

vi.mock("~/lib/aiLegibility/progress.server", () => ({
  appendLog: (...args: unknown[]) => mockAppendLog(...args),
  getProgress: (...args: unknown[]) => mockGetProgress(...args),
  setResult: vi.fn(),
  setStatus: vi.fn(),
  startNewScan: vi.fn(),
}));

vi.mock("~/lib/prisma.server", () => ({
  default: {
    aiLegibilityReport: {
      create: vi.fn(),
    },
  },
}));

vi.mock("~/lib/captureAndLogError.server", () => ({
  default: vi.fn(),
}));

function setupMswHandlers(
  responses: Record<
    string,
    { body: string; contentType?: string; status?: number }
  >,
) {
  const handlers = Object.entries(responses).map(([url, response]) => {
    const status = response.status ?? 200;
    if (status === 404) {
      return http.get(url, () => new HttpResponse(null, { status: 404 }));
    }
    return http.get(url, () =>
      HttpResponse.text(response.body, {
        status,
        headers: { "Content-Type": response.contentType ?? "text/html" },
      }),
    );
  });
  msw.use(...handlers);
}

describe("runScan", () => {
  const logs: string[] = [];

  beforeEach(() => {
    logs.length = 0;
    mockAppendLog.mockImplementation(async ({ line }: { line: string }) =>
      logs.push(line),
    );
    mockGetProgress.mockResolvedValue({ lines: [], done: true, nextOffset: 0 });
  });

  afterEach(() => {
    msw.resetHandlers();
  });

  afterAll(() => {
    msw.resetHandlers();
  });

  it("should run all checks in the correct order", async () => {
    setupMswHandlers(passingSite());

    const { result } = await runAILegibilityScan({
      log: (line: string) => {
        logs.push(line);
      },
      site: { id: "1", domain: "https://acme.com" },
      user: { id: "1", email: "test@example.com", unsubscribed: false },
    });

    const checkNames = result?.checks.map((c) => c.name);
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
    setupMswHandlers(passingSite());

    const { result } = await runAILegibilityScan({
      log: (line: string) => {
        logs.push(line);
      },
      site: { id: "1", domain: "https://acme.com" },
      user: { id: "1", email: "test@example.com", unsubscribed: false },
    });

    expect(result?.summary.critical.passed).toBeGreaterThan(0);
    expect(result?.summary.critical.total).toBe(3);
    expect(result?.summary.important.total).toBe(3);
    expect(result?.summary.optimization.total).toBe(2);
  });

  it("should produce correct summary for failing site", async () => {
    setupMswHandlers(failingSite());

    const { result } = await runAILegibilityScan({
      log: (line: string) => {
        logs.push(line);
      },
      site: { id: "1", domain: "https://acme.com" },
      user: { id: "1", email: "test@example.com", unsubscribed: false },
    });

    expect(result?.summary.critical.passed).toBe(0);
    expect(result?.summary.critical.total).toBe(3);
    expect(result?.summary.important.total).toBe(3);
    expect(result?.summary.optimization.total).toBe(2);
  });

  it("should produce correct summary for partial site", async () => {
    setupMswHandlers(partialSite());

    const { result } = await runAILegibilityScan({
      log: (line: string) => {
        logs.push(line);
      },
      site: { id: "1", domain: "https://acme.com" },
      user: { id: "1", email: "test@example.com", unsubscribed: false },
    });

    expect(result?.summary.critical.passed).toBe(3);
    expect(result?.summary.critical.total).toBe(3);
    expect(result?.summary.important.passed).toBe(1);
    expect(result?.summary.optimization.passed).toBe(2);
  });

  it("should normalize URL without protocol", async () => {
    setupMswHandlers(passingSite());

    const { result } = await runAILegibilityScan({
      log: (line: string) => {
        logs.push(line);
      },
      site: { id: "1", domain: "https://acme.com" },
      user: { id: "1", email: "test@example.com", unsubscribed: false },
    });

    expect(result?.url).toBe("https://acme.com");
  });

  it("should normalize URL with www prefix", async () => {
    const responses: Record<string, { body: string; contentType?: string }> =
      {};
    for (const [key, value] of Object.entries(passingSite())) {
      responses[key.replace("https://acme.com", "https://www.acme.com")] = {
        body: value.body,
        contentType: value.contentType,
      };
    }
    setupMswHandlers(responses);

    const { result } = await runAILegibilityScan({
      log: (line: string) => {
        logs.push(line);
      },
      site: { id: "1", domain: "https://www.acme.com" },
      user: { id: "1", email: "test@example.com", unsubscribed: false },
    });

    expect(result?.url).toBe("https://www.acme.com");
  });

  it("should lowercase hostname", async () => {
    setupMswHandlers(passingSite());

    const { result } = await runAILegibilityScan({
      log: (line: string) => {
        logs.push(line);
      },
      site: { id: "1", domain: "https://ACME.COM" },
      user: { id: "1", email: "test@example.com", unsubscribed: false },
    });

    expect(result?.url).toBe("https://acme.com");
  });

  it("should preserve existing https protocol", async () => {
    setupMswHandlers(passingSite());

    const { result } = await runAILegibilityScan({
      log: (line: string) => {
        logs.push(line);
      },
      site: { id: "1", domain: "https://acme.com" },
      user: { id: "1", email: "test@example.com", unsubscribed: false },
    });

    expect(result?.url).toBe("https://acme.com");
  });

  it("should log progress messages", async () => {
    setupMswHandlers(passingSite());

    await runAILegibilityScan({
      log: (line: string) => {
        logs.push(line);
      },
      site: { id: "1", domain: "https://acme.com" },
      user: { id: "1", email: "test@example.com", unsubscribed: false },
    });

    expect(logs.some((l) => l.includes("Checking homepage content"))).toBe(
      true,
    );
    expect(logs.some((l) => l.includes("Checking sitemap.txt"))).toBe(true);
    expect(logs.some((l) => l.includes("Critical:"))).toBe(true);
    expect(logs.some((l) => l.includes("Important:"))).toBe(true);
    expect(logs.some((l) => l.includes("Optimization:"))).toBe(true);
  });

  it("should include scannedAt timestamp", async () => {
    setupMswHandlers(passingSite());

    const { result } = await runAILegibilityScan({
      log: (line: string) => {
        logs.push(line);
      },
      site: { id: "1", domain: "https://acme.com" },
      user: { id: "1", email: "test@example.com", unsubscribed: false },
    });

    expect(result?.scannedAt).toBeDefined();
    expect(new Date(result?.scannedAt ?? "").toISOString()).toBe(
      result?.scannedAt ?? "",
    );
  });

  it("should generate suggestions for failed checks", async () => {
    setupMswHandlers(failingSite());

    const { result } = await runAILegibilityScan({
      log: (line: string) => {
        logs.push(line);
      },
      site: { id: "1", domain: "https://acme.com" },
      user: { id: "1", email: "test@example.com", unsubscribed: false },
    });

    expect(result?.suggestions.length).toBeGreaterThan(0);
    expect(result?.suggestions.some((s) => s.category === "critical")).toBe(
      true,
    );
  });

  it("should return empty suggestions when all checks pass", async () => {
    setupMswHandlers(passingSite());

    const { result } = await runAILegibilityScan({
      log: (line: string) => {
        logs.push(line);
      },
      site: { id: "1", domain: "https://acme.com" },
      user: { id: "1", email: "test@example.com", unsubscribed: false },
    });

    expect(result?.suggestions).toEqual([]);
  });

  it("should continue running all checks even when some fail", async () => {
    setupMswHandlers(failingSite());

    const { result } = await runAILegibilityScan({
      log: (line: string) => {
        logs.push(line);
      },
      site: { id: "1", domain: "https://acme.com" },
      user: { id: "1", email: "test@example.com", unsubscribed: false },
    });

    expect(result?.checks.length).toBe(8);
    expect(result?.checks.every((c) => c.name && c.category && c.message)).toBe(
      true,
    );
  });

  it("should categorize checks correctly", async () => {
    setupMswHandlers(passingSite());

    const { result } = await runAILegibilityScan({
      log: (line: string) => {
        logs.push(line);
      },
      site: { id: "1", domain: "https://acme.com" },
      user: { id: "1", email: "test@example.com", unsubscribed: false },
    });

    const criticalChecks = result?.checks.filter(
      (c) => c.category === "critical",
    );
    const importantChecks = result?.checks.filter(
      (c) => c.category === "important",
    );
    const optimizationChecks = result?.checks.filter(
      (c) => c.category === "optimization",
    );

    expect(criticalChecks?.map((c) => c.name)).toEqual(
      expect.arrayContaining(["Homepage content", "robots.txt", "sitemap.xml"]),
    );
    expect(importantChecks?.map((c) => c.name)).toEqual(
      expect.arrayContaining(["sitemap.txt", "llms.txt"]),
    );
    expect(optimizationChecks?.map((c) => c.name)).toEqual(
      expect.arrayContaining(["Meta tags", "JSON-LD"]),
    );
  });
});

describe("runScan with LLM suggestions", () => {
  const logs: string[] = [];

  beforeEach(() => {
    logs.length = 0;
    mockAppendLog.mockImplementation(async ({ line }: { line: string }) => {
      logs.push(line);
    });
    mockGetProgress.mockResolvedValue({ lines: [], done: true, nextOffset: 0 });
  });

  afterEach(() => {
    msw.resetHandlers();
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
                      category: "optimization",
                      effort: "15 min",
                      description: "Add schema.org structured data",
                    },
                    {
                      title: "Add llms.txt for AI context",
                      category: "important",
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

    const { result } = await runAILegibilityScan({
      log: (line: string) => {
        logs.push(line);
      },
      site: { id: "1", domain: "https://test-site.com" },
      user: { id: "1", email: "test@example.com", unsubscribed: false },
    });

    expect(result?.suggestions.length).toBeGreaterThanOrEqual(3);

    const criticalSuggestions = result?.suggestions.filter(
      (s) => s.category === "critical",
    );
    const importantSuggestions = result?.suggestions.filter(
      (s) => s.category === "important",
    );
    const optimizationSuggestions = result?.suggestions.filter(
      (s) => s.category === "optimization",
    );

    expect(criticalSuggestions?.length).toBeGreaterThan(0);
    expect(importantSuggestions?.length).toBeGreaterThan(0);
    expect(optimizationSuggestions?.length).toBeGreaterThan(0);

    expect(criticalSuggestions?.[0]?.title).toContain("sitemap.txt");
    expect(importantSuggestions?.[0]?.title).toContain("llms.txt");
    expect(optimizationSuggestions?.[0]?.title).toContain("JSON-LD");
  });
});
