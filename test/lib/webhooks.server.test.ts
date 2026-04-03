import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "~/lib/prisma.server";
import { emitWebhookEvent } from "~/lib/webhooks.server";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const ADMIN_ID = "user-wh-admin-1";
const USER_ID = "user-wh-user-1";
const SITE_ID = "site-wh-1";

beforeEach(async () => {
  mockFetch.mockReset();
  await prisma.user.deleteMany({ where: { id: { in: [ADMIN_ID, USER_ID] } } });

  await prisma.user.create({
    data: {
      id: ADMIN_ID,
      email: "admin-wh@test.com",
      passwordHash: "test",
      isAdmin: true,
      webhookEndpoints: {
        create: {
          id: "ep-wh-admin-1",
          url: "https://admin.test/hook",
          secret: "admin-secret",
          events: ["user.created", "site.created", "site.deleted"],
        },
      },
    },
  });

  await prisma.user.create({
    data: {
      id: USER_ID,
      email: "user-wh@test.com",
      passwordHash: "test",
      ownedSites: {
        create: {
          id: SITE_ID,
          domain: "wh-test.example.com",
          content: "",
          summary: "",
          apiKey: "test-api-key-wh-1",
        },
      },
      webhookEndpoints: {
        create: {
          id: "ep-wh-user-1",
          url: "https://user.test/hook",
          secret: "user-secret",
          events: ["site.created", "site.deleted"],
        },
      },
    },
  });
});

describe("emitWebhookEvent", () => {
  describe("user.created (admin scope)", () => {
    it("should deliver only to admin endpoints", async () => {
      mockFetch.mockResolvedValue(new Response(null, { status: 200 }));
      await emitWebhookEvent("user.created", { userId: USER_ID, email: "new@test.com" });
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch.mock.calls[0][0]).toBe("https://admin.test/hook");
    });

    it("should not deliver to non-admin endpoints", async () => {
      mockFetch.mockResolvedValue(new Response(null, { status: 200 }));
      await emitWebhookEvent("user.created", { userId: USER_ID, email: "new@test.com" });
      const deliveries = await prisma.webhookDelivery.findMany({ where: { endpointId: "ep-wh-user-1" } });
      expect(deliveries).toHaveLength(0);
    });
  });

  describe("site.created (user scope)", () => {
    it("should deliver to site owner endpoint and admin endpoint", async () => {
      mockFetch.mockResolvedValue(new Response(null, { status: 200 }));
      await emitWebhookEvent("site.created", { siteId: SITE_ID, domain: "wh-test.example.com" });
      expect(mockFetch).toHaveBeenCalledTimes(2);
      const urls = mockFetch.mock.calls.map((c) => c[0] as string);
      expect(urls).toContain("https://admin.test/hook");
      expect(urls).toContain("https://user.test/hook");
    });
  });

  describe("delivery status", () => {
    it("should mark DELIVERED on 2xx response", async () => {
      mockFetch.mockResolvedValue(new Response(null, { status: 200 }));
      await emitWebhookEvent("user.created", { userId: USER_ID });
      const delivery = await prisma.webhookDelivery.findFirst({});
      expect(delivery!.status).toBe("DELIVERED");
      expect(delivery!.attempts).toBe(1);
    });

    it("should mark RETRY on non-2xx response", async () => {
      mockFetch.mockResolvedValue(new Response(null, { status: 500 }));
      await emitWebhookEvent("user.created", { userId: USER_ID });
      const delivery = await prisma.webhookDelivery.findFirst({});
      expect(delivery!.status).toBe("RETRY");
      expect(delivery!.attempts).toBe(1);
      expect(delivery!.lastError).toBe("HTTP 500");
      expect(delivery!.nextRetryAt).not.toBeNull();
    });

    it("should mark FAILED when attempts reach max", async () => {
      mockFetch.mockResolvedValue(new Response(null, { status: 500 }));
      await emitWebhookEvent("user.created", { userId: USER_ID });
      const delivery = await prisma.webhookDelivery.findFirst({});
      await prisma.webhookDelivery.update({
        where: { id: delivery!.id },
        data: { attempts: 2, status: "RETRY", nextRetryAt: new Date() },
      });
      const { attemptDelivery } = await import("~/lib/webhooks.server");
      const endpoint = await prisma.webhookEndpoint.findUniqueOrThrow({ where: { id: "ep-wh-admin-1" } });
      const updated = await prisma.webhookDelivery.findUniqueOrThrow({ where: { id: delivery!.id } });
      await attemptDelivery(updated, endpoint);
      const final = await prisma.webhookDelivery.findUniqueOrThrow({ where: { id: delivery!.id } });
      expect(final.status).toBe("FAILED");
    });

    it("should mark RETRY on network error", async () => {
      mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));
      await emitWebhookEvent("user.created", { userId: USER_ID });
      const delivery = await prisma.webhookDelivery.findFirst({});
      expect(delivery!.status).toBe("RETRY");
      expect(delivery!.lastError).toContain("ECONNREFUSED");
    });
  });

  describe("HMAC signature", () => {
    it("should include X-Webhook-Signature header matching sha256=<hex>", async () => {
      mockFetch.mockResolvedValue(new Response(null, { status: 200 }));
      await emitWebhookEvent("user.created", { userId: USER_ID });
      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = options.headers as Record<string, string>;
      expect(headers["X-Webhook-Signature"]).toMatch(/^sha256=[0-9a-f]{64}$/);
    });

    it("should include X-Webhook-Event header", async () => {
      mockFetch.mockResolvedValue(new Response(null, { status: 200 }));
      await emitWebhookEvent("user.created", { userId: USER_ID });
      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = options.headers as Record<string, string>;
      expect(headers["X-Webhook-Event"]).toBe("user.created");
    });
  });

  describe("no matching endpoints", () => {
    it("should be a no-op when no endpoints are active", async () => {
      await prisma.webhookEndpoint.updateMany({ data: { isActive: false } });
      await emitWebhookEvent("user.created", { userId: USER_ID });
      expect(mockFetch).not.toHaveBeenCalled();
      const deliveries = await prisma.webhookDelivery.findMany({});
      expect(deliveries).toHaveLength(0);
    });
  });
});
