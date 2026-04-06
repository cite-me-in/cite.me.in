import debug from "debug";
import { data } from "react-router";
import Stripe from "stripe";
import captureAndLogError from "~/lib/captureAndLogError.server";
import envVars from "~/lib/envVars.server";
import prisma from "~/lib/prisma.server";
import stripe from "~/lib/stripe.server";
import { emitWebhookEvent } from "~/lib/webhooks.server";
import type { Route } from "./+types/api.stripe.webhook";

const logger = debug("server");

function hasRequiredStripeSignatureParts(signature: string) {
  return (
    /(?:^|,)\s*t=\d+/.test(signature) && /(?:^|,)\s*v1=[^,\s]+/.test(signature)
  );
}

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST")
    throw new Response("Method not allowed", { status: 405 });

  const sig = request.headers.get("stripe-signature");
  const body = await request.text();

  if (!sig || !envVars.STRIPE_WEBHOOK_SECRET)
    throw new Response("Missing signature", { status: 400 });
  if (!hasRequiredStripeSignatureParts(sig))
    throw new Response("Invalid signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      envVars.STRIPE_WEBHOOK_SECRET,
    );
  } catch (error) {
    if (!(error instanceof Stripe.errors.StripeSignatureVerificationError))
      captureAndLogError(error);
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

      await prisma.$transaction([
        prisma.user.update({
          where: { id: userId },
          data: { plan: "paid" },
        }),
        prisma.account.upsert({
          where: { userId },
          create: {
            user: { connect: { id: userId } },
            stripeCustomerId,
            stripeSubscriptionId,
            interval,
          },
          update: { stripeCustomerId, stripeSubscriptionId, interval },
        }),
      ]);

      logger(
        "[stripe] Activated account for user %s (interval: %s)",
        userId,
        interval,
      );
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      const account = await prisma.account.findFirst({
        where: { stripeSubscriptionId: subscription.id },
        select: { userId: true },
      });
      if (account) {
        await prisma.user.update({
          where: { id: account.userId },
          data: { plan: "cancelled" },
        });
        await emitWebhookEvent("subscription.cancelled", {
          userId: account.userId,
        });
        logger(
          "[stripe] Cancelled account for subscription %s",
          subscription.id,
        );
      }
    }
  } catch (error) {
    captureAndLogError(error);
    return data({ error: "Webhook processing failed" }, { status: 500 });
  }

  return data({ ok: true });
}
