import { describe, expect, it, vi } from "vitest";
import { extractDomain, fetchSiteContent } from "~/lib/sites.server";

vi.mock("node:dns", () => ({
  default: {
    promises: {
      resolve: vi.fn(),
    },
  },
}));

describe("extractDomain", () => {
  it("should extract hostname from full URL", () => {
    expect(extractDomain("https://example.com/path?q=1")).toBe("example.com");
  });

  it("should extract hostname when scheme is missing", () => {
    expect(extractDomain("example.com")).toBe("example.com");
  });

  it("should return null for localhost", () => {
    expect(extractDomain("http://localhost:3000")).toBeNull();
  });

  it("should return null for bare IP address", () => {
    expect(extractDomain("http://192.168.1.1")).toBeNull();
  });

  it("should return null for unparseable input", () => {
    expect(extractDomain("not a url at all !!")).toBeNull();
  });
});

describe("fetchSiteContent", () => {
  it("should return extracted text from HTML", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: (name: string) => (name === "content-type" ? "text/html" : null) },
        text: async () => "<html><body><p>Hello world</p></body></html>",
      }),
    );
    const content = await fetchSiteContent({
      domain: "example.com",
      maxPages: 5,
      maxWords: 1000,
    });
    expect(content).toContain("Hello world");
  });

  it("should return null when response is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        headers: { get: () => null },
        text: async () => "",
      }),
    );
    await expect(
      fetchSiteContent({ domain: "example.com", maxPages: 5, maxWords: 1000 }),
    ).rejects.toThrow("I couldn't fetch the main page of example.com");
  });

  it("should return null on network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    await expect(
      fetchSiteContent({ domain: "example.com", maxPages: 5, maxWords: 1000 }),
    ).rejects.toThrow("I couldn't fetch the main page of example.com");
  });
});
