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

    expect(result?.summary.discoverability.passed).toBeGreaterThan(0);
    expect(result?.summary.discoverability.total).toBe(3);
    expect(result?.summary.informative.total).toBe(4);
    expect(result?.summary["bot-access"].total).toBe(1);
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

    expect(result?.summary.discoverability.passed).toBe(0);
    expect(result?.summary.discoverability.total).toBe(3);
    expect(result?.summary.informative.total).toBe(4);
    expect(result?.summary["bot-access"].total).toBe(1);
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

    expect(result?.summary.discoverability.passed).toBe(1);
    expect(result?.summary.discoverability.total).toBe(3);
    expect(result?.summary.informative.passed).toBe(4);
    expect(result?.summary["bot-access"].passed).toBe(1);
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
    expect(logs.some((l) => l.includes("Discoverability:"))).toBe(true);
    expect(logs.some((l) => l.includes("Informative:"))).toBe(true);
    expect(logs.some((l) => l.includes("Bot Access:"))).toBe(true);
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
    expect(
      result?.suggestions.some((s) => s.category === "discoverability"),
    ).toBe(true);
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

    const discoverabilityChecks = result?.checks.filter(
      (c) => c.category === "discoverability",
    );
    const informativeChecks = result?.checks.filter(
      (c) => c.category === "informative",
    );
    const botAccessChecks = result?.checks.filter(
      (c) => c.category === "bot-access",
    );

    expect(discoverabilityChecks?.map((c) => c.name)).toEqual(
      expect.arrayContaining(["sitemap.xml", "sitemap.txt", "llms.txt"]),
    );
    expect(informativeChecks?.map((c) => c.name)).toEqual(
      expect.arrayContaining([
        "Homepage content",
        "Sample pages",
        "Meta tags",
        "JSON-LD",
      ]),
    );
    expect(botAccessChecks?.map((c) => c.name)).toEqual(
      expect.arrayContaining(["robots.txt"]),
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
                      category: "discoverability",
                      effort: "5 min",
                      description: "Create a sitemap.txt",
                    },
                    {
                      title: "Add JSON-LD structured data",
                      category: "informative",
                      effort: "15 min",
                      description: "Add schema.org structured data",
                    },
                    {
                      title: "Add llms.txt for AI context",
                      category: "discoverability",
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

    const discoverabilitySuggestions = result?.suggestions.filter(
      (s) => s.category === "discoverability",
    );
    const informativeSuggestions = result?.suggestions.filter(
      (s) => s.category === "informative",
    );

    expect(discoverabilitySuggestions?.length).toBeGreaterThan(0);
    expect(informativeSuggestions?.length).toBeGreaterThan(0);

    expect(discoverabilitySuggestions?.[0]?.title).toContain("sitemap.txt");
    expect(informativeSuggestions?.[0]?.title).toContain("JSON-LD");
  });
});
