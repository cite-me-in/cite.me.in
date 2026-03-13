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
  it("extracts hostname from full URL", () => {
    expect(extractDomain("https://example.com/path?q=1")).toBe("example.com");
  });

  it("extracts hostname when scheme is missing", () => {
    expect(extractDomain("example.com")).toBe("example.com");
  });

  it("returns null for localhost", () => {
    expect(extractDomain("http://localhost:3000")).toBeNull();
  });

  it("returns null for bare IP address", () => {
    expect(extractDomain("http://192.168.1.1")).toBeNull();
  });

  it("returns null for unparseable input", () => {
    expect(extractDomain("not a url at all !!")).toBeNull();
  });
});

describe("fetchPageContent", () => {
  it("returns extracted text from HTML", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => "<html><body><p>Hello world</p></body></html>",
      }),
    );
    const content = await fetchSiteContent({
      domain: "example.com",
      maxWords: 1000,
    });
    expect(content).toContain("Hello world");
  });

  it("returns null when response is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, text: async () => "" }),
    );
    expect(
      fetchSiteContent({ domain: "example.com", maxWords: 1000 }),
    ).rejects.toThrow("I couldn't fetch the main page of example.com");
  });

  it("returns null on network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    expect(
      fetchSiteContent({ domain: "example.com", maxWords: 1000 }),
    ).rejects.toThrow("I couldn't fetch the main page of example.com");
  });
});
