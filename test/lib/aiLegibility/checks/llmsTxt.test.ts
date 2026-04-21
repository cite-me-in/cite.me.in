import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import checkLlmsTxt from "~/lib/aiLegibility/checks/llmsTxt";
import { LLMS_TXT, mockFetch } from "../fixtures";

describe("checkLlmsTxt", () => {
  const log = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    log.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should pass when llms.txt has content", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "https://acme.com/llms.txt": {
          ok: true,
          status: 200,
          headers: { get: () => "text/plain" },
          text: async () => LLMS_TXT,
        },
      }),
    );

    const result = await checkLlmsTxt({
      url: "https://acme.com/",
      log,
    });

    expect(result.passed).toBe(true);
    expect(result.name).toBe("llms.txt");
    expect(result.category).toBe("optimization");
    expect(result.message).toContain("5 lines");
    expect(log).toHaveBeenCalledWith(expect.stringContaining("✓"));
  });

  it("should pass when llms.txt exists but is empty", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "https://acme.com/llms.txt": {
          ok: true,
          status: 200,
          headers: { get: () => "text/plain" },
          text: async () => "",
        },
      }),
    );

    const result = await checkLlmsTxt({
      url: "https://acme.com/",
      log,
    });

    expect(result.passed).toBe(true);
    expect(result.message).toContain("empty");
  });

  it("should fail when llms.txt returns 404", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "https://acme.com/llms.txt": {
          ok: true,
          status: 404,
          headers: { get: () => null },
          text: async () => "",
        },
      }),
    );

    const result = await checkLlmsTxt({
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

    const result = await checkLlmsTxt({
      url: "https://acme.com/",
      log,
    });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("Failed to fetch");
  });
});
