// When STRIPE_SECRET_KEY is set, Stripe calls go to the real API via onUnhandledRequest:"bypass".

import { HttpResponse, http } from "msw";

// When not set, mock checkout session creation so non-Stripe tests still work.
const stripeHandler = http.post(
  "https://api.stripe.com/v1/checkout/sessions",
  () =>
    HttpResponse.json({
      id: "cs_test_fake123",
      object: "checkout.session",
      url: "https://checkout.stripe.com/c/pay/cs_test_fake123",
      status: "open",
    }),
);

export default stripeHandler;
