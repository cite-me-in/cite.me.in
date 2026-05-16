import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import checkMdRoutes from "~/lib/aiLegibility/checks/mdRoutes";
import msw from "~/test/mocks/msw";

describe("checkMdRoutes", () => {
  afterEach(() => {
    msw.resetHandlers();
  });

  it("should fail when no alternate URLs are advertised", async () => {
    const result = await checkMdRoutes({ urls: [] });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("No markdown alternate URLs");
  });

  it("should pass when all advertised URLs serve valid markdown", async () => {
    msw.use(
      http.get("https://acme.com/index.md", () =>
        HttpResponse.text(
          "# Acme Corp\n\nWelcome to Acme Corp. We build great software products for businesses of all sizes.",
          {
            headers: { "Content-Type": "text/markdown" },
          },
        ),
      ),
      http.get("https://acme.com/about.md", () =>
        HttpResponse.text(
          "# About Acme\n\nWe have been serving customers since 2010. Our mission is to deliver quality software.",
          {
            headers: { "Content-Type": "text/markdown" },
          },
        ),
      ),
    );

    const result = await checkMdRoutes({
      urls: ["https://acme.com/index.md", "https://acme.com/about.md"],
    });

    expect(result.passed).toBe(true);
    expect(result.message).toContain("All 2 advertised alternate URLs");
    expect(result.details?.validCount).toBe(2);
  });

  it("should pass with a single valid URL", async () => {
    msw.use(
      http.get("https://acme.com/index.md", () =>
        HttpResponse.text(
          "# Acme Corp\n\nWelcome to Acme Corp. We build great software products for businesses of all sizes.",
          {
            headers: { "Content-Type": "text/markdown" },
          },
        ),
      ),
    );

    const result = await checkMdRoutes({
      urls: ["https://acme.com/index.md"],
    });

    expect(result.passed).toBe(true);
    expect(result.message).toContain("All 1 advertised alternate URL");
  });

  it("should fail when one of multiple URLs is invalid", async () => {
    msw.use(
      http.get("https://acme.com/index.md", () =>
        HttpResponse.text("# Acme Corp\n\nWelcome to Acme Corp. We build great software.", {
          headers: { "Content-Type": "text/markdown" },
        }),
      ),
      http.get("https://acme.com/broken.md", () =>
        HttpResponse.text("<!DOCTYPE html><html><body>404</body></html>", {
          status: 404,
        }),
      ),
    );

    const result = await checkMdRoutes({
      urls: ["https://acme.com/index.md", "https://acme.com/broken.md"],
    });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("1/2 advertised alternate URLs");
  });

  it("should fail when URL returns HTML instead of markdown", async () => {
    msw.use(
      http.get("https://acme.com/index.md", () =>
        HttpResponse.text("<!DOCTYPE html><html><head></head><body>HTML page</body></html>", {
          headers: { "Content-Type": "text/html" },
        }),
      ),
    );

    const result = await checkMdRoutes({
      urls: ["https://acme.com/index.md"],
    });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("0/1");
  });

  it("should fail when markdown content is too short", async () => {
    msw.use(
      http.get("https://acme.com/index.md", () =>
        HttpResponse.text("Hi", {
          headers: { "Content-Type": "text/markdown" },
        }),
      ),
    );

    const result = await checkMdRoutes({
      urls: ["https://acme.com/index.md"],
    });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("0/1");
  });

  it("should handle network errors gracefully", async () => {
    msw.use(http.get("https://acme.com/index.md", () => HttpResponse.error()));

    const result = await checkMdRoutes({
      urls: ["https://acme.com/index.md"],
    });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("0/1");
  });

  it("should handle timeouts gracefully", async () => {
    msw.use(http.get("https://acme.com/index.md", () => HttpResponse.error()));

    const result = await checkMdRoutes({
      urls: ["https://acme.com/index.md"],
    });

    expect(result.passed).toBe(false);
  });
});
