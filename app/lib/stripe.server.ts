import Stripe from "stripe";
import envVars from "~/lib/envVars.server";

const stripe = new Stripe(envVars.STRIPE_SECRET_KEY, {
  httpClient:
    // In test mode, use the fetch-based HTTP client so that MSW can intercept/bypass
    // requests correctly. MSW's ClientRequest interceptor doesn't emit the 'secureConnect'
    // event that the default NodeHttpClient waits for, causing a hang.
    process.env.NODE_ENV === "test"
      ? Stripe.createFetchHttpClient()
      : undefined,
});

export default stripe;
