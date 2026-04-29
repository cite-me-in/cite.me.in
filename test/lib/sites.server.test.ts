import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import prisma from "~/lib/prisma.server";
import crawl from "~/lib/scrape/crawl";
import summarize from "~/lib/scrape/summarize";
import { createSite, deleteSite, extractDomain } from "~/lib/sites.server";
import * as webhooks from "~/lib/webhooks.server";

vi.mock("node:dns", () => ({
  default: {
    promises: {
      resolve: vi.fn<() => Promise<string>>(),
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
    const content = await crawl({
      domain: "example.com",
      maxPages: 5,
      maxWords: 1000,
      maxSeconds: 10,
    });
    expect(content).toContain("Hello world");
  });

  it("should return summary from crawled content", async () => {
    const domain = "example.com";
    const content = await crawl({
      domain,
      maxPages: 5,
      maxWords: 1000,
      maxSeconds: 10,
    });
    const summary = await summarize({ domain, content });
    expect(summary).toContain("Mocked AI insight");
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
      crawl({
        domain: "example.com",
        maxPages: 5,
        maxWords: 1000,
        maxSeconds: 10,
      }),
    ).rejects.toThrow("HTTP error fetching example.com");
  });

  it("should return null on network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    await expect(
      crawl({
        domain: "example.com",
        maxPages: 5,
        maxWords: 1000,
        maxSeconds: 10,
      }),
    ).rejects.toThrow("HTTP error fetching example.com");
  });
});

describe("webhook emission", () => {
  let emitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    emitSpy = vi.spyOn(webhooks, "emitWebhookEvent").mockResolvedValue();
    await prisma.user.deleteMany({ where: { email: "sites-wh@test.com" } });
    await prisma.user.create({
      data: {
        id: "user-sites-wh-1",
        email: "sites-wh@test.com",
        passwordHash: "test",
      },
    });
  });

  afterEach(async () => {
    emitSpy.mockRestore();
    await prisma.user.deleteMany({ where: { email: "sites-wh@test.com" } });
  });

  it("should emit site.created when a new site is created", async () => {
    const site = await createSite({
      user: { id: "user-sites-wh-1", isAdmin: false, plan: "trial" },
      domain: "my-test-site-wh.example.com",
    });

    expect(emitSpy).toHaveBeenCalledWith("site.created", {
      siteId: site.id,
      domain: site.domain,
    });
  });

  it("should emit site.deleted when a site is deleted", async () => {
    const site = await prisma.site.create({
      data: {
        id: "site-sites-wh-2",
        domain: "to-delete-wh.example.com",
        content: "",
        summary: "",
        apiKey: "test-api-key-sites-wh-2",
        ownerId: "user-sites-wh-1",
      },
    });

    await deleteSite({ userId: "user-sites-wh-1", siteId: site.id });

    expect(emitSpy).toHaveBeenCalledWith("site.deleted", {
      siteId: site.id,
      domain: site.domain,
    });
  });
});
