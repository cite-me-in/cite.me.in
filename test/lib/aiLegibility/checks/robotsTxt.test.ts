import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import checkRobotsTxt from "~/lib/aiLegibility/checks/robotsTxt";
import {
  ROBOTS_EMPTY,
  ROBOTS_TXT,
  ROBOTS_TXT_AI_ALLOWED,
  ROBOTS_TXT_BLOCKS_AI,
  ROBOTS_TXT_PARTIAL_AI_BLOCK,
  mockFetch,
} from "~/test/lib/aiLegibility/fixtures";

describe("checkRobotsTxt", () => {
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

    const result = await checkRobotsTxt({ url: "https://acme.com/" });

    expect(result.passed).toBe(true);
    expect(result.name).toBe("robots.txt");
    expect(result.category).toBe("welcomed");
    expect(result.message).toContain("sitemap reference");
    expect(result.details?.hasSitemap).toBe(true);
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

    const result = await checkRobotsTxt({ url: "https://acme.com/" });

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

    const result = await checkRobotsTxt({ url: "https://acme.com/" });

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

    const result = await checkRobotsTxt({ url: "https://acme.com/" });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("not found");
  });

  it("should handle network errors", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("ECONNREFUSED");
    });

    const result = await checkRobotsTxt({ url: "https://acme.com/" });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("Failed to fetch");
  });

  it("should fail when robots.txt fully blocks AI bots", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "https://acme.com/robots.txt": {
          ok: true,
          status: 200,
          headers: { get: () => "text/plain" },
          text: async () => ROBOTS_TXT_BLOCKS_AI,
        },
      }),
    );

    const result = await checkRobotsTxt({ url: "https://acme.com/" });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("blocks AI bots");
    const bots = result.details?.blockedAiBots as {
      agent: string;
      displayName: string;
    }[];
    expect(bots).toHaveLength(4);
    expect(bots.map((b) => b.agent)).toEqual(
      expect.arrayContaining([
        "GPTBot",
        "ClaudeBot",
        "Google-Extended",
        "CCBot",
      ]),
    );
    expect(result.details?.suggestedFix).toContain("Allow: /");
  });

  it("should pass when robots.txt has AI bots with Allow rules", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "https://acme.com/robots.txt": {
          ok: true,
          status: 200,
          headers: { get: () => "text/plain" },
          text: async () => ROBOTS_TXT_AI_ALLOWED,
        },
      }),
    );

    const result = await checkRobotsTxt({ url: "https://acme.com/" });

    expect(result.passed).toBe(true);
    expect(result.details?.blockedAiBots).toBeUndefined();
  });

  it("should not flag AI bots with partial Disallow (not /)", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "https://acme.com/robots.txt": {
          ok: true,
          status: 200,
          headers: { get: () => "text/plain" },
          text: async () => ROBOTS_TXT_PARTIAL_AI_BLOCK,
        },
      }),
    );

    const result = await checkRobotsTxt({ url: "https://acme.com/" });

    expect(result.passed).toBe(true);
    expect(result.details?.blockedAiBots).toBeUndefined();
  });

  it("should detect single AI bot block", async () => {
    const robotsSingleBlock = `User-agent: GPTBot
Disallow: /
`;

    vi.stubGlobal(
      "fetch",
      mockFetch({
        "https://acme.com/robots.txt": {
          ok: true,
          status: 200,
          headers: { get: () => "text/plain" },
          text: async () => robotsSingleBlock,
        },
      }),
    );

    const result = await checkRobotsTxt({ url: "https://acme.com/" });

    expect(result.passed).toBe(false);
    const bots = result.details?.blockedAiBots as {
      agent: string;
      displayName: string;
    }[];
    expect(bots).toHaveLength(1);
    expect(bots[0].agent).toBe("GPTBot");
    expect(result.details?.suggestedFix).toContain("User-agent: GPTBot");
    expect(result.details?.suggestedFix).toContain("Allow: /");
  });
});
