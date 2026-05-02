import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it } from "vite-plus/test";
import checkContentSignals from "~/lib/aiLegibility/checks/contentSignals";
import { ROBOTS_TXT_WITH_SIGNAL } from "~/test/lib/aiLegibility/fixtures";
import msw from "~/test/mocks/msw";

describe("checkContentSignals", () => {
  afterEach(() => {
    msw.resetHandlers();
  });

  it("should pass with valid Content-Signal (search=yes, ai-input=yes, ai-train=no)", async () => {
    msw.use(
      http.get("https://acme.com/robots.txt", () =>
        HttpResponse.text(ROBOTS_TXT_WITH_SIGNAL, {
          headers: { "Content-Type": "text/plain" },
        }),
      ),
    );

    const result = await checkContentSignals({ url: "https://acme.com/" });

    expect(result.passed).toBe(true);
    expect(result.message).toContain("Content-Signal");
    expect(result.details?.signals).toHaveLength(3);
    const signals = result.details?.signals as
      | { key: string; value: string; valid: boolean }[]
      | undefined;
    expect(signals?.every((s) => s.valid)).toBe(true);
  });

  it("should pass with single valid Content-Signal key", async () => {
    msw.use(
      http.get("https://acme.com/robots.txt", () =>
        HttpResponse.text(
          "User-agent: *\nDisallow:\n\nContent-Signal: search=yes\n",
          {
            headers: { "Content-Type": "text/plain" },
          },
        ),
      ),
    );

    const result = await checkContentSignals({ url: "https://acme.com/" });

    expect(result.passed).toBe(true);
    const signals = result.details?.signals as
      | { key: string; value: string }[]
      | undefined;
    expect(signals).toHaveLength(1);
    expect(signals![0].key).toBe("search");
    expect(signals![0].value).toBe("yes");
  });

  it("should fail when all Content-Signal keys are invalid", async () => {
    msw.use(
      http.get("https://acme.com/robots.txt", () =>
        HttpResponse.text(
          "User-agent: *\n\nContent-Signal: unknown-key=yes\n",
          {
            headers: { "Content-Type": "text/plain" },
          },
        ),
      ),
    );

    const result = await checkContentSignals({ url: "https://acme.com/" });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("all directives invalid");
  });

  it("should report warnings for invalid keys alongside valid ones", async () => {
    msw.use(
      http.get("https://acme.com/robots.txt", () =>
        HttpResponse.text(
          "User-agent: *\n\nContent-Signal: search=yes, unknown=maybe\n",
          {
            headers: { "Content-Type": "text/plain" },
          },
        ),
      ),
    );

    const result = await checkContentSignals({ url: "https://acme.com/" });

    expect(result.passed).toBe(true);
    expect(result.message).toContain("Warnings");
  });

  it("should fail when a valid key has invalid value", async () => {
    msw.use(
      http.get("https://acme.com/robots.txt", () =>
        HttpResponse.text("User-agent: *\n\nContent-Signal: search=maybe\n", {
          headers: { "Content-Type": "text/plain" },
        }),
      ),
    );

    const result = await checkContentSignals({ url: "https://acme.com/" });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("must be yes or no");
  });

  it("should fail when robots.txt has no Content-Signal", async () => {
    msw.use(
      http.get("https://acme.com/robots.txt", () =>
        HttpResponse.text("User-agent: *\nDisallow:\n", {
          headers: { "Content-Type": "text/plain" },
        }),
      ),
    );

    const result = await checkContentSignals({ url: "https://acme.com/" });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("No Content-Signal");
  });

  it("should fail when robots.txt returns 404", async () => {
    msw.use(
      http.get("https://acme.com/robots.txt", () =>
        HttpResponse.text("", { status: 404 }),
      ),
    );

    const result = await checkContentSignals({ url: "https://acme.com/" });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("robots.txt returned HTTP 404");
  });

  it("should handle network errors", async () => {
    msw.use(
      http.get("https://acme.com/robots.txt", () => HttpResponse.error()),
    );

    const result = await checkContentSignals({ url: "https://acme.com/" });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("Failed to check");
  });

  it("should handle malformed key=value pairs", async () => {
    msw.use(
      http.get("https://acme.com/robots.txt", () =>
        HttpResponse.text("User-agent: *\n\nContent-Signal: justastring\n", {
          headers: { "Content-Type": "text/plain" },
        }),
      ),
    );

    const result = await checkContentSignals({ url: "https://acme.com/" });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("Malformed");
  });
});
