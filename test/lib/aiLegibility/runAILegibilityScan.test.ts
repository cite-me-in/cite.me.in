import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import runAILegibilityScan from "~/lib/aiLegibility/runAILegibilityScan";
import msw from "~/test/mocks/msw";
import { failingSite, partialSite, passingSite } from "./fixtures";

const mockAppendLog = vi.fn<({ line }: { line: string }) => void>();
const mockGetProgress = vi.fn<() => { lines: never[]; done: boolean; nextOffset: number }>();

vi.mock("~/lib/aiLegibility/progress.server", () => ({
  appendLog: (line: string) => mockAppendLog({ line }),
  getProgress: () => mockGetProgress(),
  setResult: vi.fn<() => void>(),
  setStatus: vi.fn<() => void>(),
  startNewScan: vi.fn<() => void>(),
}));

vi.mock("~/lib/prisma.server", () => ({
  default: {
    aiLegibilityReport: {
      create: vi.fn<() => void>(),
    },
  },
}));

vi.mock("~/lib/captureAndLogError.server", () => ({
  default: vi.fn<() => void>(),
}));

function setupMswHandlers(
  responses: Record<
    string,
    {
      body: string;
      contentType?: string;
      status?: number;
      headers?: Record<string, string>;
    }
  >,
) {
  const handlers = Object.entries(responses).flatMap(([url, response]) => {
    const status = response.status ?? 200;
    const extra = response.headers ?? {};
    if (status === 404) {
      return [
        http.get(url, () => new HttpResponse(null, { status: 404 })),
        http.head(url, () => new HttpResponse(null, { status: 404 })),
      ];
    }
    return [
      http.get(url, () =>
        HttpResponse.text(response.body, {
          status,
          headers: {
            "Content-Type": response.contentType ?? "text/html",
            ...extra,
          },
        }),
      ),
      http.head(
        url,
        () =>
          new HttpResponse(null, {
            status,
            headers: {
              "Content-Type": response.contentType ?? "text/html",
              ...extra,
            },
          }),
      ),
    ];
  });
  msw.use(...handlers);
}

describe("runScan", () => {
  const logs: string[] = [];

  beforeEach(() => {
    logs.length = 0;
    mockAppendLog.mockImplementation(async ({ line }: { line: string }) => logs.push(line));
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
      "Page content",
      "robots.txt",
      "sitemap.xml",
      "sitemap.txt",
      "Sample pages",
      "JSON-LD",
      "Meta tags",
      "llms.txt",
      "Sitemap link headers",
      "Markdown alternate links",
      ".md routes",
      "Robots directives",
      "Markdown content negotiation",
      "Content Signals",
      "AI bot traffic",
      "llms-full.txt",
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

    expect(result?.summary.discovered.passed).toBeGreaterThan(0);
    expect(result?.summary.discovered.total).toBe(6);
    expect(result?.summary.trusted.total).toBe(5);
    expect(result?.summary.welcomed.total).toBe(5);
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

    expect(result?.summary.discovered.passed).toBe(0);
    expect(result?.summary.discovered.total).toBe(6);
    expect(result?.summary.trusted.total).toBe(5);
    expect(result?.summary.welcomed.total).toBe(5);
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

    expect(result?.summary.discovered.passed).toBe(2);
    expect(result?.summary.discovered.total).toBe(6);
    expect(result?.summary.trusted.passed).toBe(2);
    expect(result?.summary.welcomed.passed).toBe(3);
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
    const responses: Record<string, { body: string; contentType?: string }> = {};
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

    expect(logs.some((l) => l.includes("Checking page content"))).toBe(true);
    expect(logs.some((l) => l.includes("Checking sitemap.txt"))).toBe(true);
    expect(logs.some((l) => l.includes("Checking sitemap link headers"))).toBe(true);
    expect(logs.some((l) => l.includes("Checking markdown alternate links"))).toBe(true);
    expect(logs.some((l) => l.includes("Checking .md routes"))).toBe(true);
    expect(logs.some((l) => l.includes("Checking markdown content negotiation"))).toBe(true);
    expect(logs.some((l) => l.includes("Checking Content-Signal in robots.txt"))).toBe(true);
    expect(logs.some((l) => l.includes("Discovered:"))).toBe(true);
    expect(logs.some((l) => l.includes("Trusted:"))).toBe(true);
    expect(logs.some((l) => l.includes("Welcomed:"))).toBe(true);
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
    expect(new Date(result?.scannedAt ?? "").toISOString()).toBe(result?.scannedAt ?? "");
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

    expect(result?.checks.length).toBe(16);
    expect(result?.checks.every((c) => c.name && c.category && c.message)).toBe(true);
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

    const discoveredChecks = result?.checks.filter((c) => c.category === "discovered");
    const trustedChecks = result?.checks.filter((c) => c.category === "trusted");
    const welcomedChecks = result?.checks.filter((c) => c.category === "welcomed");

    expect(discoveredChecks?.map((c) => c.name)).toEqual(
      expect.arrayContaining([
        "sitemap.xml",
        "sitemap.txt",
        "llms.txt",
        "Sitemap link headers",
        "Markdown alternate links",
      ]),
    );
    expect(trustedChecks?.map((c) => c.name)).toEqual(
      expect.arrayContaining([
        "Page content",
        "Sample pages",
        "Meta tags",
        "Markdown content negotiation",
        ".md routes",
      ]),
    );
    expect(welcomedChecks?.map((c) => c.name)).toEqual(
      expect.arrayContaining([
        "robots.txt",
        "Content Signals",
        "JSON-LD",
        "Robots directives",
        "AI bot traffic",
      ]),
    );
  });
});
