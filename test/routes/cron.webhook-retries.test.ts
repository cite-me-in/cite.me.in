import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { port } from "../helpers/launchBrowser";
import prisma from "~/lib/prisma.server";

async function makeRequest() {
  return fetch(`http://localhost:${port}/cron/webhook-retries`, {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
}

const ENDPOINT_ID = "ep-cron-retry-1";

afterEach(async () => {
  await prisma.user.deleteMany({
    where: { email: "admin-cron-retry@test.com" },
  });
});

beforeEach(async () => {
  await prisma.webhookDelivery.deleteMany({
    where: { endpointId: ENDPOINT_ID },
  });
  await prisma.user.deleteMany({
    where: { email: "admin-cron-retry@test.com" },
  });

  await prisma.user.create({
    data: {
      id: "user-cron-retry-1",
      email: "admin-cron-retry@test.com",
      passwordHash: "test",
      isAdmin: true,
      webhookEndpoints: {
        create: {
          id: ENDPOINT_ID,
          url: "https://admin.test/hook",
          secret: "test-secret",
          events: ["user.created"],
        },
      },
    },
  });
});

describe("cron.webhook-retries", () => {
  describe("auth", () => {
    it("should return 401 without Authorization header", async () => {
      const res = await fetch(`http://localhost:${port}/cron/webhook-retries`);
      expect(res.status).toBe(401);
    });

    it("should return 401 with wrong secret", async () => {
      const res = await fetch(`http://localhost:${port}/cron/webhook-retries`, {
        headers: { authorization: "Bearer wrong-secret" },
      });
      expect(res.status).toBe(401);
    });
  });

  describe("retry processing", () => {
    it("should process RETRY deliveries where nextRetryAt is in the past", async () => {
      await prisma.webhookDelivery.create({
        data: {
          id: "delivery-cron-1",
          endpointId: ENDPOINT_ID,
          eventType: "user.created",
          payload: {},
          status: "RETRY",
          attempts: 1,
          nextRetryAt: new Date(Date.now() - 1000),
        },
      });

      const res = await makeRequest();
      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: boolean; processed: number };
      expect(body.ok).toBe(true);
      expect(body.processed).toBe(1);
    });

    it("should skip RETRY deliveries where nextRetryAt is in the future", async () => {
      await prisma.webhookDelivery.create({
        data: {
          id: "delivery-cron-2",
          endpointId: ENDPOINT_ID,
          eventType: "user.created",
          payload: {},
          status: "RETRY",
          attempts: 1,
          nextRetryAt: new Date(Date.now() + 60_000),
        },
      });

      const res = await makeRequest();
      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: boolean; processed: number };
      expect(body.ok).toBe(true);
      expect(body.processed).toBe(0);
    });

    it("should skip DELIVERED and FAILED deliveries", async () => {
      await prisma.webhookDelivery.createMany({
        data: [
          {
            id: "delivery-cron-3",
            endpointId: ENDPOINT_ID,
            eventType: "user.created",
            payload: {},
            status: "DELIVERED",
            attempts: 1,
          },
          {
            id: "delivery-cron-4",
            endpointId: ENDPOINT_ID,
            eventType: "user.created",
            payload: {},
            status: "FAILED",
            attempts: 3,
          },
        ],
      });

      const res = await makeRequest();
      const body = (await res.json()) as { processed: number };
      expect(body.processed).toBe(0);
    });
  });
});
