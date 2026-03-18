import Stripe from "stripe";
import envVars from "~/lib/envVars";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!envVars.STRIPE_SECRET_KEY)
    throw new Error("STRIPE_SECRET_KEY is not configured");
  if (!_stripe) _stripe = new Stripe(envVars.STRIPE_SECRET_KEY);
  return _stripe;
}

export function getMonthlyPriceId(): string {
  if (!envVars.STRIPE_PRICE_MONTHLY_ID)
    throw new Error("STRIPE_PRICE_MONTHLY_ID is not configured");
  return envVars.STRIPE_PRICE_MONTHLY_ID;
}

export function getAnnualPriceId(): string {
  if (!envVars.STRIPE_PRICE_ANNUAL_ID)
    throw new Error("STRIPE_PRICE_ANNUAL_ID is not configured");
  return envVars.STRIPE_PRICE_ANNUAL_ID;
}
