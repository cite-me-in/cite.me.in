import debug from "debug";
import type Stripe from "stripe";
import { data } from "react-router";
import envVars from "~/lib/envVars";
import logError from "~/lib/logError.server";
import prisma from "~/lib/prisma.server";
import { getStripe } from "~/lib/stripe.server";
import type { Route } from "./+types/api.stripe.webhook";

const logger = debug("server");

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST")
    throw new Response("Method not allowed", { status: 405 });

  const stripe = getStripe();
  const sig = request.headers.get("stripe-signature");
  const body = await request.text();

  if (!sig || !envVars.STRIPE_WEBHOOK_SECRET)
    throw new Response("Missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, envVars.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    logError(error);
    throw new Response("Invalid signature", { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      const interval = session.metadata?.interval ?? "monthly";
      const stripeCustomerId = session.customer as string;
      const stripeSubscriptionId = session.subscription as string;

      if (!userId) throw new Error("Missing userId in session metadata");

      await prisma.account.upsert({
        where: { userId },
        create: {
          userId,
          stripeCustomerId,
          stripeSubscriptionId,
          status: "active",
          interval,
        },
        update: {
          stripeCustomerId,
          stripeSubscriptionId,
          status: "active",
          interval,
        },
      });

      logger("[stripe] Activated account for user %s (interval: %s)", userId, interval);
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      const account = await prisma.account.findFirst({
        where: { stripeSubscriptionId: subscription.id },
      });
      if (account) {
        await prisma.account.update({
          where: { id: account.id },
          data: { status: "cancelled" },
        });
        logger("[stripe] Deactivated account for subscription %s", subscription.id);
      }
    }
  } catch (error) {
    logError(error);
    return data({ error: "Webhook processing failed" }, { status: 500 });
  }

  return data({ ok: true });
}
