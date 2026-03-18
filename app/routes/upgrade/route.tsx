import { StarIcon } from "lucide-react";
import { redirect } from "react-router";
import { Button } from "~/components/ui/Button";
import Main from "~/components/ui/Main";
import { requireUser } from "~/lib/auth.server";
import envVars from "~/lib/envVars";
import prisma from "~/lib/prisma.server";
import { getAnnualPriceId, getMonthlyPriceId, getStripe } from "~/lib/stripe.server";
import type { Route } from "./+types/route";

export function meta(): Route.MetaDescriptors {
  return [{ title: "Upgrade to Pro | Cite.me.in" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const account = await prisma.account.findUnique({ where: { userId: user.id } });
  if (account?.status === "active") return redirect("/sites");
  return {};
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const form = await request.formData();
  const interval = form.get("interval")?.toString() ?? "monthly";

  const stripe = getStripe();
  const priceId = interval === "annual" ? getAnnualPriceId() : getMonthlyPriceId();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: user.email,
    client_reference_id: user.id,
    success_url: `${envVars.VITE_APP_URL}/upgrade/success`,
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
        <h1 className="font-heading text-4xl mb-2">Upgrade to Pro</h1>
        <p className="text-foreground/70 mb-10">
          25 days free, no credit card. Most tools give you a week — we give you
          enough time to actually see results. When you're ready, $29/mo keeps
          it all running.
        </p>

        <div className="rounded-base border-2 border-black shadow-[4px_4px_0px_0px_black] p-8 mb-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="font-heading text-2xl">Pro</h2>
              <p className="text-foreground/60">For founders building in public</p>
            </div>
            <div className="text-right">
              <p className="font-heading text-3xl">$29<span className="text-base font-normal">/mo</span></p>
              <p className="text-sm text-foreground/60">or $249/year (save $99)</p>
            </div>
          </div>

          <ul className="space-y-2 mb-8 text-sm">
            {[
              "All 4 platforms: ChatGPT, Claude, Gemini, Perplexity",
              "Daily citation runs, indefinitely",
              "Full citation history preserved and growing",
              "Up to 3 domains",
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
                Subscribe — $29/month
              </Button>
            </form>
            <form method="post">
              <input type="hidden" name="interval" value="annual" />
              <Button type="submit" variant="outline" className="w-full">
                Subscribe — $249/year
              </Button>
            </form>
          </div>
        </div>

        <p className="text-center text-sm text-foreground/60">
          cite.me.in is built by one person. Your $29/mo is what keeps it
          independent, updated, and not acquired by someone with a worse product
          vision.
        </p>
        <p className="text-center text-sm text-foreground/60 mt-2">
          cite.me.in is open-source. If we ever shut down, you take the code and
          run it yourself.
        </p>
      </div>
    </Main>
  );
}
