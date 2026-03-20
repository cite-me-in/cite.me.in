import Stripe from "stripe";
import { beforeAll, describe, expect, it } from "vitest";
import envVars from "~/lib/envVars";
import prisma from "~/lib/prisma.server";
import { port } from "~/test/helpers/launchBrowser";

const BASE_URL = `http://localhost:${port}/api/stripe/webhook`;
const stripe = new Stripe(envVars.STRIPE_SECRET_KEY, {
  httpClient: Stripe.createFetchHttpClient(),
});

function signedRequest(payload: string) {
  const sig = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: envVars.STRIPE_WEBHOOK_SECRET,
  });
  return fetch(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "stripe-signature": sig },
    body: payload,
  });
}

describe("api.stripe.webhook", () => {
  beforeAll(async () => {
    await prisma.user.create({
      data: {
        id: "user-webhook-1",
        email: "webhook@test.com",
        passwordHash: "test",
      },
    });
  });

  it("should return 400 when stripe-signature header is missing", async () => {
    const response = await fetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "checkout.session.completed" }),
    });
    expect(response.status).toBe(400);
  });

  it("should return 400 for invalid signature", async () => {
    const response = await fetch(BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": "invalid",
      },
      body: JSON.stringify({ type: "checkout.session.completed" }),
    });
    expect(response.status).toBe(400);
  });

  it("should return 200 and ignore unknown event types", async () => {
    const payload = JSON.stringify({ type: "payment_intent.created", data: { object: {} } });
    const response = await signedRequest(payload);
    expect(response.status).toBe(200);
  });

  describe("checkout.session.completed", () => {
    it("should activate account and store Stripe IDs", async () => {
      const payload = JSON.stringify({
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_webhook_1",
            object: "checkout.session",
            metadata: { userId: "user-webhook-1", interval: "monthly" },
            customer: "cus_webhook_1",
            subscription: "sub_webhook_1",
          },
        },
      });

      const response = await signedRequest(payload);
      expect(response.status).toBe(200);

      const account = await prisma.account.findUnique({
        where: { userId: "user-webhook-1" },
      });
      expect(account?.status).toBe("active");
      expect(account?.interval).toBe("monthly");
      expect(account?.stripeCustomerId).toBe("cus_webhook_1");
      expect(account?.stripeSubscriptionId).toBe("sub_webhook_1");
    });

    it("should activate account with annual interval", async () => {
      const payload = JSON.stringify({
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_webhook_2",
            object: "checkout.session",
            metadata: { userId: "user-webhook-1", interval: "annual" },
            customer: "cus_webhook_1",
            subscription: "sub_webhook_2",
          },
        },
      });

      const response = await signedRequest(payload);
      expect(response.status).toBe(200);

      const account = await prisma.account.findUnique({
        where: { userId: "user-webhook-1" },
      });
      expect(account?.interval).toBe("annual");
    });
  });

  describe("customer.subscription.deleted", () => {
    it("should cancel account when subscription is deleted", async () => {
      // Ensure account exists and is active first
      await prisma.account.upsert({
        where: { userId: "user-webhook-1" },
        create: {
          userId: "user-webhook-1",
          stripeCustomerId: "cus_webhook_1",
          stripeSubscriptionId: "sub_webhook_cancel",
          status: "active",
          interval: "monthly",
        },
        update: {
          stripeSubscriptionId: "sub_webhook_cancel",
          status: "active",
        },
      });

      const payload = JSON.stringify({
        type: "customer.subscription.deleted",
        data: {
          object: { id: "sub_webhook_cancel", object: "subscription" },
        },
      });

      const response = await signedRequest(payload);
      expect(response.status).toBe(200);

      const account = await prisma.account.findUnique({
        where: { userId: "user-webhook-1" },
      });
      expect(account?.status).toBe("cancelled");
    });

    it("should return 200 when subscription is not found", async () => {
      const payload = JSON.stringify({
        type: "customer.subscription.deleted",
        data: {
          object: { id: "sub_unknown", object: "subscription" },
        },
      });

      const response = await signedRequest(payload);
      expect(response.status).toBe(200);
    });
  });
});
