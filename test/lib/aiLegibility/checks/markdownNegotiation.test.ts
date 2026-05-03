import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it } from "vite-plus/test";
import checkMarkdownNegotiation from "~/lib/aiLegibility/checks/markdownNegotiation";
import msw from "~/test/mocks/msw";

describe("checkMarkdownNegotiation", () => {
  afterEach(() => {
    msw.resetHandlers();
  });

  it("should pass when homepage serves markdown with Accept: text/markdown", async () => {
    msw.use(
      http.get("https://acme.com/", () =>
        HttpResponse.text(
          "# Acme Corp\n\nWelcome to Acme Corp. We are a leading provider of software solutions. Our team has been building great products since 2010.",
          {
            headers: { "Content-Type": "text/markdown" },
          },
        ),
      ),
    );

    const result = await checkMarkdownNegotiation({
      pages: [{ url: "https://acme.com/" }],
    });

    expect(result.passed).toBe(true);
    expect(result.message).toContain("1/1 pages serve markdown");
  });

  it("should pass when sample page serves markdown but homepage doesn't", async () => {
    msw.use(
      http.get("https://acme.com/", () =>
        HttpResponse.text(
          "<!DOCTYPE html><html><head></head><body>HTML</body></html>",
          {
            headers: { "Content-Type": "text/html" },
          },
        ),
      ),
      http.get("https://acme.com/about", () =>
        HttpResponse.text(
          "# About Acme\n\nWe build software. Our company was founded in 2015 and has grown to serve thousands of customers worldwide.",
          {
            headers: { "Content-Type": "text/markdown" },
          },
        ),
      ),
    );

    const result = await checkMarkdownNegotiation({
      pages: [{ url: "https://acme.com/" }, { url: "https://acme.com/about" }],
    });

    expect(result.passed).toBe(true);
    expect(result.message).toContain("1/2 pages serve markdown");
  });

  it("should pass when some sample pages serve markdown", async () => {
    msw.use(
      http.get("https://acme.com/", () =>
        HttpResponse.text("HTML page", {
          headers: { "Content-Type": "text/html" },
        }),
      ),
      http.get("https://acme.com/about", () =>
        HttpResponse.text(
          "# About\n\nContent about the company. This is a longer markdown document that exceeds the minimum threshold of 50 characters to be considered valid.",
          {
            headers: { "Content-Type": "text/markdown" },
          },
        ),
      ),
      http.get("https://acme.com/contact", () =>
        HttpResponse.text("HTML contact", {
          headers: { "Content-Type": "text/html" },
        }),
      ),
    );

    const result = await checkMarkdownNegotiation({
      pages: [
        { url: "https://acme.com/" },
        { url: "https://acme.com/about" },
        { url: "https://acme.com/contact" },
      ],
    });

    expect(result.passed).toBe(true);
    expect(result.message).toContain("1/3 pages serve markdown");
  });

  it("should fail when markdown has no meaningful content", async () => {
    msw.use(
      http.get("https://acme.com/", () =>
        HttpResponse.text("Hi", {
          headers: { "Content-Type": "text/markdown" },
        }),
      ),
    );

    const result = await checkMarkdownNegotiation({
      pages: [{ url: "https://acme.com/" }],
    });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("too short");
  });

  it("should fail when no page serves markdown", async () => {
    msw.use(
      http.get("https://acme.com/", () =>
        HttpResponse.text(
          "<!DOCTYPE html><html><head></head><body>HTML</body></html>",
          {
            headers: { "Content-Type": "text/html" },
          },
        ),
      ),
    );

    const result = await checkMarkdownNegotiation({
      pages: [{ url: "https://acme.com/" }],
    });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("No page serves markdown");
  });

  it("should fail when server returns 406 for Accept: text/markdown", async () => {
    msw.use(
      http.get("https://acme.com/", () =>
        HttpResponse.text("", { status: 406 }),
      ),
    );

    const result = await checkMarkdownNegotiation({
      pages: [{ url: "https://acme.com/" }],
    });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("406");
  });

  it("should handle network errors gracefully", async () => {
    msw.use(http.get("https://acme.com/", () => HttpResponse.error()));

    const result = await checkMarkdownNegotiation({
      pages: [{ url: "https://acme.com/" }],
    });

    expect(result.passed).toBe(false);
    expect(result.message).toContain("No page serves markdown");
  });

  it("should handle sample page fetch failure gracefully", async () => {
    msw.use(
      http.get("https://acme.com/", () =>
        HttpResponse.text(
          "# Acme Corp\n\nWelcome. Our company provides software solutions for businesses of all sizes across the globe.",
          {
            headers: { "Content-Type": "text/markdown" },
          },
        ),
      ),
      http.get("https://acme.com/timeout", () => HttpResponse.error()),
    );

    const result = await checkMarkdownNegotiation({
      pages: [
        { url: "https://acme.com/" },
        { url: "https://acme.com/timeout" },
      ],
    });

    expect(result.passed).toBe(true);
    expect(result.message).toContain("1/2 pages serve markdown");
  });
});
