import { beforeAll, describe, expect, it, vi } from "vitest";
import prisma from "~/lib/prisma.server";

vi.mock("~/lib/citingPageHealth.server", () => ({
  checkCitingPageHealth: vi.fn().mockResolvedValue({
    statusCode: 200,
    contentHash: "abc123",
    isHealthy: true,
  }),
}));

vi.mock("~/lib/envVars.server", () => ({
  default: { CRON_SECRET: "test-secret" },
}));

describe("cron.check-citing-pages", () => {
  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { id: "user-cip-1", email: "cip@test.com", passwordHash: "x" },
    });
    await prisma.site.create({
      data: {
        id: "site-cip-1",
        domain: "example.com",
        ownerId: user.id,
        content: "",
        summary: "",
        apiKey: "key-cip-1",
      },
    });
    await prisma.citingPage.create({
      data: {
        id: "page-cip-1",
        url: "https://example.com/guide",
        siteId: "site-cip-1",
        citationCount: 5,
      },
    });
  });

  it("should check health and update CitingPage record", async () => {
    const { loader } = await import("~/routes/cron.check-citing-pages");
    const request = new Request("http://localhost/cron/check-citing-pages", {
      headers: { authorization: "Bearer test-secret" },
    });
    const response = await loader({
      request,
      params: {},
      context: {},
    } as never);
    const body = response.data;
    expect(body.ok).toBe(true);

    const page = await prisma.citingPage.findUnique({
      where: { id: "page-cip-1" },
    });
    expect(page?.statusCode).toBe(200);
    expect(page?.isHealthy).toBe(true);
    expect(page?.lastCheckedAt).toBeTruthy();
  });

  it("should reject requests without auth", async () => {
    const { loader } = await import("~/routes/cron.check-citing-pages");
    const request = new Request("http://localhost/cron/check-citing-pages");
    await expect(
      loader({ request, params: {}, context: {} } as never),
    ).rejects.toThrow();
  });
});
