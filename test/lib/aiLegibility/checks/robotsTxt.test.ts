import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import checkRobotsTxt from "~/lib/aiLegibility/checks/robotsTxt";
import { ROBOTS_EMPTY, ROBOTS_TXT, mockFetch } from "../fixtures";

describe("checkRobotsTxt", () => {
  const log = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    log.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should pass when robots.txt has crawl rules and sitemap reference", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "https://acme.com/robots.txt": {
          ok: true,
          status: 200,
          headers: { get: () => "text/plain" },
          text: async () => ROBOTS_TXT,
        },
      }),
    );

    const result = await checkRobotsTxt({
      url: "https://acme.com/",
      log,
    });

    expect(result.passed).toBe(true);
    expect(result.name).toBe("robots.txt");
    expect(result.category).toBe("important");
    expect(result.message).toContain("sitemap reference");
    expect(result.details?.hasSitemap).toBe(true);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("✓"));
  });

  it("should pass when robots.txt has crawl rules without sitemap", async () => {
    const robotsNoSitemap = `User-agent: *
Disallow: /admin/`;

    vi.stubGlobal(
      "fetch",
      mockFetch({
        "https://acme.com/robots.txt": {
          ok: true,
          status: 200,
          headers: { get: () => "text/plain" },
          text: async () => robotsNoSitemap,
        },
      }),
    );

    const result = await checkRobotsTxt({
      url: "https://acme.com/",
      log,
    });

    expect(result.passed).toBe(true);
    expect(result.message).not.toContain("sitemap reference");
    expect(result.details?.hasSitemap).toBe(false);
  });

  it("should pass with warning when robots.txt exists but has no crawl rules", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "https://acme.com/robots.txt": {
          ok: true,
          status: 200,
          headers: { get: () => "text/plain" },
          text: async () => ROBOTS_EMPTY,
        },
      }),
    );

    const result = await checkRobotsTxt({
      url: "https://acme.com/",
      log,
    });

    expect(result.passed).toBe(true);
    expect(result.message).toContain("no crawl rules");
  });

  it("should fail when robots.txt returns 404", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "https://acme.com/robots.txt": {
          ok: false,
          status: 404,
          headers: { get: () => null },
          text: async () => "",
        },
      }),
    );

    const result = await checkRobotsTxt({
      url: "https://acme.com/",
      log,
    });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("not found");
  });

  it("should handle network errors", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("ECONNREFUSED");
    });

    const result = await checkRobotsTxt({
      url: "https://acme.com/",
      log,
    });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("Failed to fetch");
  });
});
