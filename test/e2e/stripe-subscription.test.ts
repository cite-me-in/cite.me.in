import test, { type Page, expect } from "@playwright/test";
import Stripe from "stripe";
import envVars from "~/lib/envVars";
import prisma from "~/lib/prisma.server";
import { goto, port } from "~/test/helpers/launchBrowser";
import "~/test/helpers/toMatchVisual";

let page: Page;
let userId: string;

test.beforeAll(async () => {
  // Sign up via UI to establish an authenticated browser session
  page = await goto("/sign-up");
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("stripe-e2e@example.com");
  await page
    .getByRole("textbox", { name: "Password", exact: true })
    .fill("password123");
  await page
    .getByRole("textbox", { name: "Confirm password", exact: true })
    .fill("password123");
  await expect(page.locator("main")).toMatchVisual({
    name: "e2e-stripe/1.sign-up",
  });

  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("/sites");
  await expect(page.locator("main")).toMatchVisual({
    name: "e2e-stripe/2.sites",
  });

  const user = await prisma.user.findUniqueOrThrow({
    where: { email: "stripe-e2e@example.com" },
  });
  userId = user.id;

  await page.goto(`http://localhost:${port}/upgrade`, { waitUntil: "load" });
  await page.waitForFunction(
    () => document.body.getAttribute("data-hydrated") === "true",
  );
  await expect(page.locator("main")).toMatchVisual({
    name: "e2e-stripe/3.upgrade",
  });
});

test("loads upgrade page", async () => {
  await expect(
    page.getByRole("heading", { name: /upgrade to pro/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /subscribe.*\$29\/month/i }),
  ).toBeVisible();
});

test("subscribe button creates Stripe checkout session", async () => {
  const [request] = await Promise.all([
    page.waitForRequest((req) => req.url().includes("checkout.stripe.com")),
    page.getByRole("button", { name: /subscribe.*\$29\/month/i }).click(),
  ]);

  expect(request.url()).toContain("checkout.stripe.com");

  // The navigation to Stripe was blocked; restore page to a known state
  await page.goto(`http://localhost:${port}/upgrade`, { waitUntil: "load" });
  await page.waitForFunction(
    () => document.body.getAttribute("data-hydrated") === "true",
  );
});

test("webhook activates account", async () => {
  const stripe = new Stripe(envVars.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
  });

  // Create customer, attach payment method, and create subscription via API
  const customer = await stripe.customers.create({
    email: "stripe-e2e@example.com",
  });
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

  const account = await prisma.account.findUnique({ where: { userId } });
  expect(account?.status).toBe("active");
  expect(account?.stripeCustomerId).toBe(customer.id);
  expect(account?.stripeSubscriptionId).toBe(subscription.id);
});

test("upgrade page redirects to /sites when account is active", async () => {
  await page.goto(`http://localhost:${port}/upgrade`, { waitUntil: "load" });
  await expect(page).toHaveURL("/sites");
});
