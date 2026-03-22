import { describe, expect, it, vi } from "vitest";
import { crawl } from "~/lib/scrape/crawl";
import { summarize } from "~/lib/scrape/summarize";
import { extractDomain } from "~/lib/sites.server";

vi.mock("node:dns", () => ({
  default: {
    promises: {
      resolve: vi.fn(),
    },
  },
}));

describe("extractDomain", () => {
  it("should extract hostname from full URL", () => {
    expect(extractDomain("https://example.com/path?q=1")).toBe("example.com");
  });

  it("should extract hostname when scheme is missing", () => {
    expect(extractDomain("example.com")).toBe("example.com");
  });

  it("should return null for localhost", () => {
    expect(extractDomain("http://localhost:3000")).toBeNull();
  });

  it("should return null for bare IP address", () => {
    expect(extractDomain("http://192.168.1.1")).toBeNull();
  });

  it("should return null for unparseable input", () => {
    expect(extractDomain("not a url at all !!")).toBeNull();
  });
});

describe("fetchSiteContent", () => {
  it("should return extracted text from HTML", async () => {
    const content = await crawl({
      domain: "example.com",
      maxPages: 5,
      maxWords: 1000,
      maxSeconds: 10,
    });
    expect(content).toContain("Hello world");
  });

  it("should return summary from crawled content", async () => {
    const domain = "example.com";
    const content = await crawl({
      domain,
      maxPages: 5,
      maxWords: 1000,
      maxSeconds: 10,
    });
    vi.clearAllMocks();
    const summary = await summarize({ domain, content });
    expect(summary).toContain("Summar of the content of example.com");
  });

  it("should return null when response is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        headers: { get: () => null },
        text: async () => "",
      }),
    );
    await expect(
      crawl({
        domain: "example.com",
        maxPages: 5,
        maxWords: 1000,
        maxSeconds: 10,
      }),
    ).rejects.toThrow("HTTP error fetching example.com");
  });

  it("should return null on network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    await expect(
      crawl({
        domain: "example.com",
        maxPages: 5,
        maxWords: 1000,
        maxSeconds: 10,
      }),
    ).rejects.toThrow("HTTP error fetching example.com");
  });
});
