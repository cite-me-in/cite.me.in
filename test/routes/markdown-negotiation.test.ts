import { expect } from "playwright/test";
import { describe, it } from "vite-plus/test";
import { port } from "~/test/helpers/launchServer";

describe("Accept: text/markdown content negotiation", () => {
  it("should return text/markdown content-type when Accept header includes text/markdown", async () => {
    const response = await fetch(`http://localhost:${port}/`, {
      headers: { Accept: "text/markdown" },
    });
    expect(response.ok).toBe(true);
    expect(response.headers.get("content-type")).toBe("text/markdown");
  });

  it("should return markdown without HTML tags", async () => {
    const response = await fetch(`http://localhost:${port}/`, {
      headers: { Accept: "text/markdown" },
    });
    const body = await response.text();
    expect(body).not.toContain("<!DOCTYPE html");
    expect(body).not.toMatch(/<html|<div|<a\s+href/i);
  });

  it("should include meaningful text content", async () => {
    const response = await fetch(`http://localhost:${port}/`, {
      headers: { Accept: "text/markdown" },
    });
    const body = await response.text();
    expect(body.length).toBeGreaterThan(100);
    // Should contain actual page content, not just navigation
    expect(body).not.toMatch(/^[\s\w.,;:'"!?-]+$/);
  });

  it("should not apply markdown conversion without the Accept header", async () => {
    const response = await fetch(`http://localhost:${port}/`);
    expect(response.headers.get("content-type")).not.toBe("text/markdown");
  });

  it("should prefer markdown over other content types in Accept header", async () => {
    const response = await fetch(`http://localhost:${port}/`, {
      headers: { Accept: "text/markdown, text/html;q=0.9" },
    });
    expect(response.headers.get("content-type")).toBe("text/markdown");
  });
});
