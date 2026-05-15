import { createHash, createHmac } from "node:crypto";
import test, { type Page, expect } from "@playwright/test";
import Stripe from "stripe";
import envVars from "~/lib/envVars.server";
import prisma from "~/lib/prisma.server";
import { goto } from "~/test/helpers/launchBrowser";
import { port } from "~/test/helpers/launchServer";
import "~/test/helpers/toMatchVisual";

const TEST_EMAIL = "stripe-e2e@example.com";
const TEST_PASSWORD = "password123";

// Skip if using the default fake Stripe key — CI doesn't inject real credentials
const hasStripeCredentials = envVars.STRIPE_SECRET_KEY !== "sk_test_1234567890";
test.skip(!hasStripeCredentials, "No real Stripe credentials configured");

test.describe.configure({ mode: "serial" });

let page: Page;
let userId: string;

test.beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
});

test("should sign up for a new account", async () => {
  page = await goto("/sign-up");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(TEST_EMAIL);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("textbox", { name: "Confirm password", exact: true }).fill(TEST_PASSWORD);
  await expect(page.locator("main")).toMatchVisual({
    name: "e2e/stripe/1.sign-up",
  });

  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("/sites");
  await expect(page.locator("main")).toMatchVisual({
    name: "e2e/stripe/2.sites",
  });

  const user = await prisma.user.findUniqueOrThrow({
    where: { email: TEST_EMAIL },
  });
  userId = user.id;
});

test("should show monthly and annual subscription options on sites page", async () => {
  await expect(page.getByRole("button", { name: /subscribe.*\$\d+\/month/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /subscribe.*\$\d+\/year/i })).toBeVisible();
});

test("should start Stripe checkout for monthly plan", async () => {
  const [request] = await Promise.all([
    page.waitForRequest((req) => req.url().includes("checkout.stripe.com")),
    page.getByRole("button", { name: /subscribe.*\$\d+\/month/i }).click(),
  ]);

  expect(request.url()).toContain("checkout.stripe.com");

  // Restore page after Stripe redirect
  await page.goto(`http://localhost:${port}/sites`, { waitUntil: "load" });
  await page.waitForFunction(() => document.body.getAttribute("data-hydrated") === "true");
});

test("should activate account via webhook", async () => {
  const stripe = new Stripe(envVars.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
  });

  // Create customer, attach payment method, and create subscription via API
  const customer = await stripe.customers.create({ email: TEST_EMAIL });
  const paymentMethod = await stripe.paymentMethods.attach("pm_card_visa", {
    customer: customer.id,
  });
  await stripe.customers.update(customer.id, {
    invoice_settings: { default_payment_method: paymentMethod.id },
  });
  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: envVars.STRIPE_PRICE_MONTHLY_ID }],
    default_payment_method: paymentMethod.id,
  });

  // Craft checkout.session.completed webhook and deliver to the server
  const payload = JSON.stringify({
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_stripe_e2e",
        object: "checkout.session",
        metadata: { userId, interval: "monthly" },
        customer: customer.id,
        subscription: subscription.id,
      },
    },
  });

  const sig = stripe.webhooks.generateTestHeaderString({
    timestamp: Date.now(),
    scheme: "v1",
    signature: "",
    cryptoProvider: {
      computeHMACSignature: (payload: string, secret: string) =>
        createHmac("sha256", secret).update(payload).digest("hex"),
      computeHMACSignatureAsync: (payload: string, secret: string) =>
        Promise.resolve(createHmac("sha256", secret).update(payload).digest("hex")),
      computeSHA256Async: (data: Uint8Array) =>
        Promise.resolve(createHash("sha256").update(data).digest()),
    },
    payload,
    secret: envVars.STRIPE_WEBHOOK_SECRET,
  });

  const response = await fetch(`http://localhost:${port}/api/stripe/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": sig,
    },
    body: payload,
  });

  expect(response.status).toBe(200);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  expect(user?.plan).toBe("paid");
  const account = await prisma.account.findUnique({ where: { userId } });
  expect(account?.interval).toBe("monthly");
  expect(account?.stripeCustomerId).toBe(customer.id);
  expect(account?.stripeSubscriptionId).toBe(subscription.id);
});

test("should show pro state on sites page after subscribing", async () => {
  await page.goto(`http://localhost:${port}/sites`, { waitUntil: "load" });
  await page.waitForFunction(() => document.body.getAttribute("data-hydrated") === "true");

  await expect(page.getByRole("button", { name: "Add Site" })).toBeVisible();
  await expect(page.getByRole("button", { name: /subscribe/i })).not.toBeVisible();
  await expect(page.locator("main")).toMatchVisual({
    name: "e2e/stripe/3.sites-pro",
  });
});
