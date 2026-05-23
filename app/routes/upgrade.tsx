import { StarIcon } from "lucide-react";
import { redirect } from "react-router";
import { Button } from "~/components/ui/Button";
import Main from "~/components/ui/Main";
import prices from "~/data/stripe-prices.json";
import { requireUserAccess } from "~/lib/auth.server";
import envVars from "~/lib/envVars.server";
import getStripe from "~/lib/stripe.server";
import type { Route } from "./+types/upgrade";

export function meta(): Route.MetaDescriptors {
  return [{ title: "Upgrade to Pro | Cite.me.in" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await requireUserAccess(request);
  if (user.plan === "paid" || user.plan === "gratis") return redirect("/sites");
  else return {};
}

export async function action({ request }: Route.ActionArgs) {
  const { user } = await requireUserAccess(request);
  const form = await request.formData();
  const intervalValue = form.get("interval");
  const interval =
    typeof intervalValue === "string" ? intervalValue : "monthly";

  const priceId =
    interval === "annual"
      ? envVars.STRIPE_PRICE_ANNUAL_ID
      : envVars.STRIPE_PRICE_MONTHLY_ID;

  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: user.email,
    client_reference_id: user.id,
    success_url: `${envVars.VITE_APP_URL}/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${envVars.VITE_APP_URL}/upgrade`,
    metadata: { userId: user.id, interval },
  });

  if (!session.url) return { error: "Could not create checkout session" };
  return redirect(session.url);
}

export default function UpgradePage() {
  return (
    <Main>
      <div className="mx-auto max-w-lg py-16">
        <h1 className="font-heading mb-2 text-4xl">Upgrade to Pro</h1>
        <p className="text-foreground/70 mb-10">
          25 days free, no credit card. Most tools give you a week — we give you
          enough time to actually see results. When you're ready, $
          {prices.monthlyAmount}/mo keeps it all running.
        </p>

        <div className="rounded-base mb-6 border-2 border-black p-8 shadow-[4px_4px_0px_0px_black]">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h2 className="font-heading text-2xl">Pro</h2>
              <p className="text-foreground/60">
                For founders building in public
              </p>
            </div>
            <div className="text-right">
              <p className="font-heading text-3xl">
                ${prices.monthlyAmount}
                <span className="text-base font-normal">/mo</span>
              </p>
              <p className="text-foreground/60 text-sm">
                or ${prices.annualAmount}/year (save ${prices.annualSavings})
              </p>
            </div>
          </div>

          <ul className="mb-8 space-y-2 text-sm">
            {[
              "All 3 platforms: ChatGPT, Claude, Gemini",
              "Daily citation runs, indefinitely",
              "Full citation history preserved and growing",
              "Up to 5 sites",
              "API access",
              "Email digests and alerts",
              "Benchmark data — see how you compare",
            ].map((feature) => (
              <li key={feature} className="flex items-center gap-2">
                <StarIcon className="size-4 shrink-0 text-amber-500" />
                {feature}
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-3">
            <form method="post">
              <input type="hidden" name="interval" value="monthly" />
              <Button type="submit" className="w-full">
                Subscribe — ${prices.monthlyAmount}/month
              </Button>
            </form>
          </div>
        </div>

        <p className="text-foreground/60 text-center text-sm">
          cite.me.in is built by one person. Your ${prices.monthlyAmount}/mo is
          what keeps it independent, updated, and not acquired by someone with
          an alt product vision.
        </p>
        <p className="text-foreground/60 mt-2 text-center text-sm">
          cite.me.in is open-source. If we ever shut down, you take the code and
          run it yourself.
        </p>
      </div>
    </Main>
  );
}
