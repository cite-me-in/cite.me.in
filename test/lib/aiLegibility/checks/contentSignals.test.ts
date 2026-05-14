import { describe, expect, it } from "vite-plus/test";
import checkContentSignals from "~/lib/aiLegibility/checks/contentSignals";
import { ROBOTS_TXT_WITH_SIGNAL } from "~/test/lib/aiLegibility/fixtures";

describe("checkContentSignals", () => {
  it("should pass with valid Content-Signal (search=yes, ai-input=yes, ai-train=no)", async () => {
    const result = await checkContentSignals({
      robotsContent: ROBOTS_TXT_WITH_SIGNAL,
    });

    expect(result.passed).toBe(true);
    expect(result.message).toContain("Content-Signal");
    expect(result.details?.signals).toHaveLength(3);
    const signals = result.details?.signals as
      | { key: string; value: string; valid: boolean }[]
      | undefined;
    expect(signals?.every((s) => s.valid)).toBe(true);
  });

  it("should pass with single valid Content-Signal key", async () => {
    const result = await checkContentSignals({
      robotsContent: "User-agent: *\nDisallow:\n\nContent-Signal: search=yes\n",
    });

    expect(result.passed).toBe(true);
    const signals = result.details?.signals as { key: string; value: string }[] | undefined;
    expect(signals).toHaveLength(1);
    expect(signals![0].key).toBe("search");
    expect(signals![0].value).toBe("yes");
  });

  it("should fail when all Content-Signal keys are invalid", async () => {
    const result = await checkContentSignals({
      robotsContent: "User-agent: *\n\nContent-Signal: unknown-key=yes\n",
    });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("all directives invalid");
  });

  it("should report warnings for invalid keys alongside valid ones", async () => {
    const result = await checkContentSignals({
      robotsContent: "User-agent: *\n\nContent-Signal: search=yes, unknown=maybe\n",
    });

    expect(result.passed).toBe(true);
    expect(result.message).toContain("Warnings");
  });

  it("should fail when a valid key has invalid value", async () => {
    const result = await checkContentSignals({
      robotsContent: "User-agent: *\n\nContent-Signal: search=maybe\n",
    });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("must be yes or no");
  });

  it("should fail when robots.txt has no Content-Signal", async () => {
    const result = await checkContentSignals({
      robotsContent: "User-agent: *\nDisallow:\n",
    });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("No Content-Signal");
  });

  it("should fail when robotsContent is null (not found)", async () => {
    const result = await checkContentSignals({
      robotsContent: null,
    });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("robots.txt not found");
  });

  it("should handle malformed key=value pairs", async () => {
    const result = await checkContentSignals({
      robotsContent: "User-agent: *\n\nContent-Signal: justastring\n",
    });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("Malformed");
  });
});
