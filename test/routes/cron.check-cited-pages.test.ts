import { beforeAll, describe, expect, it, vi } from "vitest";
import prisma from "~/lib/prisma.server";

vi.mock("~/lib/citedPageHealth.server", () => ({
  checkCitedPageHealth: vi.fn().mockResolvedValue({
    statusCode: 200,
    contentHash: "abc123",
    isHealthy: true,
  }),
}));

vi.mock("~/lib/envVars.server", () => ({
  default: { CRON_SECRET: "test-secret" },
}));

describe("cron.check-cited-pages", () => {
  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { id: "user-ccp-1", email: "ccp@test.com", passwordHash: "x" },
    });
    await prisma.site.create({
      data: {
        id: "site-ccp-1",
        domain: "example.com",
        ownerId: user.id,
        content: "",
        summary: "",
        apiKey: "key-ccp-1",
      },
    });
    await prisma.citedPage.create({
      data: {
        id: "page-ccp-1",
        url: "https://example.com/guide",
        siteId: "site-ccp-1",
        citationCount: 5,
      },
    });
  });

  it("should check health and update CitedPage record", async () => {
    const { loader } = await import("~/routes/cron.check-cited-pages");
    const request = new Request("http://localhost/cron/check-cited-pages", {
      headers: { authorization: "Bearer test-secret" },
    });
    const response = await loader({
      request,
      params: {},
      context: {},
    } as never);
    const body = await (response as unknown as Response).json();
    expect(body.ok).toBe(true);

    const page = await prisma.citedPage.findUnique({
      where: { id: "page-ccp-1" },
    });
    expect(page?.statusCode).toBe(200);
    expect(page?.isHealthy).toBe(true);
    expect(page?.lastCheckedAt).toBeTruthy();
  });

  it("should reject requests without auth", async () => {
    const { loader } = await import("~/routes/cron.check-cited-pages");
    const request = new Request("http://localhost/cron/check-cited-pages");
    await expect(
      loader({ request, params: {}, context: {} } as never),
    ).rejects.toThrow();
  });
});
