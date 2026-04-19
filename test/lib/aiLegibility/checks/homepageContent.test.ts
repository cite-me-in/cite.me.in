import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import checkHomepageContent from "~/lib/aiLegibility/checks/homepageContent";
import {
  HOMEPAGE_EMPTY_BODY,
  HOMEPAGE_SPA_SHELL,
  HOMEPAGE_WITH_CONTENT,
  mockFetch,
} from "../fixtures";

describe("checkHomepageContent", () => {
  const log = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    log.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should pass when homepage has sufficient content", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "https://acme.com/": {
          ok: true,
          status: 200,
          headers: { get: () => "text/html" },
          text: async () => HOMEPAGE_WITH_CONTENT,
        },
      }),
    );

    const result = await checkHomepageContent({
      url: "https://acme.com/",
      log,
    });

    expect(result.passed).toBe(true);
    expect(result.name).toBe("Homepage content");
    expect(result.category).toBe("critical");
    expect(result.message).toContain("characters of text content");
    expect(result.html).toBe(HOMEPAGE_WITH_CONTENT);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("✓"));
  });

  it("should fail when homepage is an empty SPA shell", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "https://acme.com/": {
          ok: true,
          status: 200,
          headers: { get: () => "text/html" },
          text: async () => HOMEPAGE_SPA_SHELL,
        },
      }),
    );

    const result = await checkHomepageContent({
      url: "https://acme.com/",
      log,
    });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("empty SPA shell");
    expect(result.details?.isSpaShell).toBe(true);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("✗"));
  });

  it("should fail when homepage has minimal content", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "https://acme.com/": {
          ok: true,
          status: 200,
          headers: { get: () => "text/html" },
          text: async () => HOMEPAGE_EMPTY_BODY,
        },
      }),
    );

    const result = await checkHomepageContent({
      url: "https://acme.com/",
      log,
    });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("minimal content");
  });

  it("should fail when homepage returns HTTP error", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "https://acme.com/": {
          ok: false,
          status: 500,
          headers: { get: () => "text/html" },
          text: async () => "Internal Server Error",
        },
      }),
    );

    const result = await checkHomepageContent({
      url: "https://acme.com/",
      log,
    });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("HTTP 500");
    expect(result.details?.statusCode).toBe(500);
  });

  it("should handle DNS resolution errors", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("ENOTFOUND acme.invalid");
    });

    const result = await checkHomepageContent({
      url: "https://acme.invalid/",
      log,
    });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("Could not resolve domain");
  });

  it("should handle network errors", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("ECONNREFUSED");
    });

    const result = await checkHomepageContent({
      url: "https://acme.com/",
      log,
    });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("Failed to fetch homepage");
  });
});
