import type { Prisma, WebhookDelivery, WebhookEndpoint } from "~/prisma";
import { ms } from "convert";
import captureAndLogError from "~/lib/captureAndLogError.server";
import crypto from "node:crypto";
import prisma from "~/lib/prisma.server";
import debug from "debug";

const WEBHOOK_EVENT_CONFIG = {
  "user.created": { scope: "admin" as const },
  "site.created": { scope: "user" as const },
  "site.deleted": { scope: "user" as const },
} as const;
const MAX_ATTEMPTS = 3;
const RETRY_DELAY = ms("5m");

const logger = debug("server");

export async function emitWebhookEvent(
  eventType: keyof typeof WEBHOOK_EVENT_CONFIG,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const config = WEBHOOK_EVENT_CONFIG[eventType];
    let userFilter: object;

    if (config.scope === "admin") {
      userFilter = { isAdmin: true };
    } else {
      const siteId = payload.siteId as string;
      const site = await prisma.site.findUniqueOrThrow({
        where: { id: siteId },
        select: { ownerId: true },
      });
      userFilter = { OR: [{ id: site.ownerId }, { isAdmin: true }] };
    }

    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { isActive: true, events: { has: eventType }, user: userFilter },
    });
    if (endpoints.length === 0) return;

    await Promise.all(
      endpoints.map(async (endpoint) => {
        const delivery = await prisma.webhookDelivery.create({
          data: {
            endpointId: endpoint.id,
            eventType,
            payload: payload as Prisma.InputJsonValue,
            status: "PENDING",
          },
        });
        await attemptDelivery(delivery, endpoint);
      }),
    );
  } catch (error) {
    captureAndLogError(error, { extra: { eventType, payload } });
  }
}

export async function attemptDelivery(
  delivery: WebhookDelivery,
  endpoint: WebhookEndpoint,
): Promise<void> {
  const body = JSON.stringify({
    event: delivery.eventType,
    timestamp: new Date().toISOString(),
    ...(delivery.payload as object),
  });
  const signature = computeHmac(body, endpoint.secret);

  logger("[webhooks] ATTEMPT %s to %s", delivery.id, endpoint.url);
  try {
    const res = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": `sha256=${signature}`,
        "X-Webhook-Event": delivery.eventType,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });

    if (res.ok) {
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: { status: "DELIVERED", attempts: delivery.attempts + 1 },
      });
      logger("[webhooks] DELIVERED to %s", endpoint.url);
    } else {
      await scheduleRetry(delivery, `HTTP ${res.status}`);
      logger("[webhooks] RETRY to %s: %s", endpoint.url, res.status);
    }
  } catch (error) {
    await scheduleRetry(delivery, String(error));
    logger("[webhooks] RETRY to %s: %s", endpoint.url, error);
  }
}

async function scheduleRetry(
  delivery: WebhookDelivery,
  lastError: string,
): Promise<void> {
  const attempts = delivery.attempts + 1;
  await prisma.webhookDelivery.update({
    where: { id: delivery.id },
    data:
      attempts >= MAX_ATTEMPTS
        ? { status: "FAILED", attempts, lastError }
        : {
            status: "RETRY",
            attempts,
            lastError,
            nextRetryAt: new Date(Date.now() + RETRY_DELAY),
          },
  });
}

function computeHmac(body: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}
