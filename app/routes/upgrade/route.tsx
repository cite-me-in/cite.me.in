import { StarIcon } from "lucide-react";
import { redirect } from "react-router";
import { Button } from "~/components/ui/Button";
import Main from "~/components/ui/Main";
import { requireUser } from "~/lib/auth.server";
import envVars from "~/lib/envVars";
import prisma from "~/lib/prisma.server";
import stripe from "~/lib/stripe.server";
import type { Route } from "./+types/route";

export function meta(): Route.MetaDescriptors {
  return [{ title: "Upgrade to Pro | Cite.me.in" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const account = await prisma.account.findUnique({
    where: { userId: user.id },
  });
  if (account?.status === "active") return redirect("/sites");
  return {};
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const form = await request.formData();
  const interval = form.get("interval")?.toString() ?? "monthly";

  const priceId =
    interval === "annual"
      ? envVars.STRIPE_PRICE_ANNUAL_ID
      : envVars.STRIPE_PRICE_MONTHLY_ID;

  const session = await stripe.checkout.sessions.create({
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
        <h1 className="mb-2 font-heading text-4xl">Upgrade to Pro</h1>
        <p className="mb-10 text-foreground/70">
          25 days free, no credit card. Most tools give you a week — we give you
          enough time to actually see results. When you're ready, $35/mo keeps
          it all running.
        </p>

        <div className="mb-6 rounded-base border-2 border-black p-8 shadow-[4px_4px_0px_0px_black]">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h2 className="font-heading text-2xl">Pro</h2>
              <p className="text-foreground/60">
                For founders building in public
              </p>
            </div>
            <div className="text-right">
              <p className="font-heading text-3xl">
                $35<span className="font-normal text-base">/mo</span>
              </p>
              <p className="text-foreground/60 text-sm">
                or $320/year (save $99)
              </p>
            </div>
          </div>

          <ul className="mb-8 space-y-2 text-sm">
            {[
              "All 4 platforms: ChatGPT, Claude, Gemini, Perplexity",
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
                Subscribe — $35/month
              </Button>
            </form>
          </div>
        </div>

        <p className="text-center text-foreground/60 text-sm">
          cite.me.in is built by one person. Your $35/mo is what keeps it
          independent, updated, and not acquired by someone with an alt product
          vision.
        </p>
        <p className="mt-2 text-center text-foreground/60 text-sm">
          cite.me.in is open-source. If we ever shut down, you take the code and
          run it yourself.
        </p>
      </div>
    </Main>
  );
}
