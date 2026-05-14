import Stripe from "stripe";
import envVars from "~/lib/envVars.server";

let stripe: Stripe | undefined;

export default function getStripe(): Stripe {
  if (!stripe) {
    const apiKey = envVars.STRIPE_SECRET_KEY;
    stripe = new Stripe(apiKey, {
      httpClient:
        // In test mode, use the fetch-based HTTP client so that MSW can intercept/bypass
        // requests correctly. MSW's ClientRequest interceptor doesn't emit the 'secureConnect'
        // event that the default NodeHttpClient waits for, causing a hang.
        process.env.NODE_ENV === "test" ? Stripe.createFetchHttpClient() : undefined,
    });
  }
  return stripe;
}
