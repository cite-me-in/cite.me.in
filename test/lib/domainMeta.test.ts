import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearDomainMetaCache, getDomainMeta } from "~/lib/domainMeta.server";

describe("getDomainMeta", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearDomainMetaCache();
  });

  it("should extract og:site_name when present", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        url: "https://www.example-a.com/",
        text: async () =>
          `<html><head><meta property="og:site_name" content="Example Brand" /></head></html>`,
      }),
    );
    const meta = await getDomainMeta("example-a.com");
    expect(meta.brandName).toBe("Example Brand");
    expect(meta.url).toBe("https://www.example-a.com/");
  });

  it("should extract title and strip suffix when og:site_name is absent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        url: "https://example-b.com/",
        text: async () =>
          "<html><head><title>Acme Corp - Home</title></head></html>",
      }),
    );
    const meta = await getDomainMeta("example-b.com");
    expect(meta.brandName).toBe("Acme Corp");
  });

  it("should fall back to prettified domain on network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error")),
    );
    const meta = await getDomainMeta("example-c.com");
    expect(meta.brandName).toBe("Example-c");
    expect(meta.url).toBe("https://example-c.com");
  });

  it("should prettify hyphenated domains in fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error")),
    );
    const meta = await getDomainMeta("some-brand.io");
    expect(meta.brandName).toBe("Some Brand");
  });
});
