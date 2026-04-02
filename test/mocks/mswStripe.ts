import { HttpResponse, http } from "msw";

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
