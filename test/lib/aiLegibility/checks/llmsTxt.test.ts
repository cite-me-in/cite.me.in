import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpResponse, http } from "msw";
import msw from "~/test/mocks/msw";
import checkLlmsTxt from "~/lib/aiLegibility/checks/llmsTxt";
import { LLMS_TXT } from "../fixtures";

describe("checkLlmsTxt", () => {
  const log = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    log.mockClear();
  });

  afterEach(() => {
    msw.resetHandlers();
  });

  it("should pass when llms.txt has content", async () => {
    msw.use(
      http.get("https://acme.com/llms.txt", () =>
        HttpResponse.text(LLMS_TXT, {
          headers: { "Content-Type": "text/plain" },
        }),
      ),
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
    msw.use(
      http.get("https://acme.com/llms.txt", () =>
        HttpResponse.text("", {
          headers: { "Content-Type": "text/plain" },
        }),
      ),
    );

    const result = await checkLlmsTxt({
      url: "https://acme.com/",
      log,
    });

    expect(result.passed).toBe(true);
    expect(result.message).toContain("empty");
  });

  it("should fail when llms.txt returns 404", async () => {
    msw.use(
      http.get("https://acme.com/llms.txt", () =>
        HttpResponse.text("", { status: 404 }),
      ),
    );

    const result = await checkLlmsTxt({
      url: "https://acme.com/",
      log,
    });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("not found");
  });

  it("should handle network errors", async () => {
    msw.use(
      http.get("https://acme.com/llms.txt", () => HttpResponse.error()),
    );

    const result = await checkLlmsTxt({
      url: "https://acme.com/",
      log,
    });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("Failed to fetch");
  });
});
