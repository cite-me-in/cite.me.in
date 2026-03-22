import { describe, expect, it, vi } from "vitest";
import { fetchAndExtract } from "~/lib/scrape/extract";
import {
  CANONICAL_SKIP_HTML,
  HTML_ARTICLE_CONTENT,
  HTML_ID_ROOT,
  HTML_MAIN_CONTENT,
  HTML_ROLE_MAIN,
  JSON_LD_HTML,
  MARKDOWN_RESPONSE,
  mockFetch,
} from "./fixtures";

describe("fetchAndExtract", () => {
  it("should return markdown body directly when content-type is text/markdown", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "https://acme.com/about": {
          ok: true,
          status: 200,
          headers: { get: (h: string) => (h === "content-type" ? "text/markdown" : null) },
          text: async () => MARKDOWN_RESPONSE,
        },
      }),
    );
    const result = await fetchAndExtract(
      "https://acme.com/about",
      AbortSignal.timeout(5000),
    );
    expect(result).not.toBeNull();
    expect(result?.text).toContain("We build great things");
    expect(result?.text).toContain("Our Mission");
  });

  it("should extract articleBody from JSON-LD when present", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "https://acme.com/article": {
          ok: true,
          status: 200,
          headers: { get: (h: string) => (h === "content-type" ? "text/html" : null) },
          text: async () => JSON_LD_HTML,
        },
      }),
    );
    const result = await fetchAndExtract(
      "https://acme.com/article",
      AbortSignal.timeout(5000),
    );
    expect(result).not.toBeNull();
    expect(result?.text).toContain("main article content extracted from JSON-LD");
    expect(result?.text).not.toContain("noisy sidebar");
  });

  it("should return null when fetch response is not ok", async () => {
    vi.stubGlobal("fetch", mockFetch({}));
    const result = await fetchAndExtract(
      "https://acme.com/missing",
      AbortSignal.timeout(5000),
    );
    expect(result).toBeNull();
  });

  it("should return null when content-type is not HTML or Markdown", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "https://acme.com/file.pdf": {
          ok: true,
          status: 200,
          headers: { get: (h: string) => (h === "content-type" ? "application/pdf" : null) },
          text: async () => "binary content",
        },
      }),
    );
    const result = await fetchAndExtract(
      "https://acme.com/file.pdf",
      AbortSignal.timeout(5000),
    );
    expect(result).toBeNull();
  });

  it("should extract content from <main> element", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "https://acme.com/page": {
          ok: true,
          status: 200,
          headers: { get: (h: string) => (h === "content-type" ? "text/html" : null) },
          text: async () => HTML_MAIN_CONTENT,
        },
      }),
    );
    const result = await fetchAndExtract(
      "https://acme.com/page",
      AbortSignal.timeout(5000),
    );
    expect(result?.text).toContain("main content of the page");
    expect(result?.text).not.toContain("Nav stuff");
    expect(result?.text).not.toContain("Footer stuff");
  });

  it("should extract content from <article> element when no <main>", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "https://acme.com/blog/post": {
          ok: true,
          status: 200,
          headers: { get: (h: string) => (h === "content-type" ? "text/html" : null) },
          text: async () => HTML_ARTICLE_CONTENT,
        },
      }),
    );
    const result = await fetchAndExtract(
      "https://acme.com/blog/post",
      AbortSignal.timeout(5000),
    );
    expect(result?.text).toContain("article content that should be extracted");
    expect(result?.text).not.toContain("Navigation ignored");
  });

  it("should extract content from [role=main] when no <main> or <article>", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "https://acme.com/app": {
          ok: true,
          status: 200,
          headers: { get: (h: string) => (h === "content-type" ? "text/html" : null) },
          text: async () => HTML_ROLE_MAIN,
        },
      }),
    );
    const result = await fetchAndExtract(
      "https://acme.com/app",
      AbortSignal.timeout(5000),
    );
    expect(result?.text).toContain("Content inside role=main");
  });

  it("should extract content from #root element as final fallback", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "https://acme.com/app": {
          ok: true,
          status: 200,
          headers: { get: (h: string) => (h === "content-type" ? "text/html" : null) },
          text: async () => HTML_ID_ROOT,
        },
      }),
    );
    const result = await fetchAndExtract(
      "https://acme.com/app",
      AbortSignal.timeout(5000),
    );
    expect(result?.text).toContain("Content inside #root");
  });

  it("should return empty text for pages with rel=canonical pointing elsewhere", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "https://acme.com/duplicate": {
          ok: true,
          status: 200,
          headers: { get: (h: string) => (h === "content-type" ? "text/html" : null) },
          text: async () => CANONICAL_SKIP_HTML,
        },
      }),
    );
    const result = await fetchAndExtract(
      "https://acme.com/duplicate",
      AbortSignal.timeout(5000),
    );
    expect(result?.text).toBe("");
  });
});
