import { CheckIcon } from "lucide-react";
import { Link } from "react-router";
import Main from "~/components/ui/Main";

export function meta() {
  return [
    { title: "Pricing | Cite.me.in" },
    {
      name: "description",
      content:
        "Start free for 25 days. Upgrade to Pro for $29/month to keep your citation history and continue monitoring.",
    },
  ];
}

export default function PricingPage() {
  return (
    <Main>
      <div className="mx-auto max-w-5xl py-16 px-4">
        <h1 className="font-heading text-4xl mb-4 text-center">Pricing</h1>
        <p className="text-center text-foreground/70 mb-12 max-w-xl mx-auto">
          Monitor your brand's AI citation visibility. Start free — no credit
          card required.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FreeTierCard />
          <ProTierCard />
          <CustomTierCard />
        </div>
      </div>
    </Main>
  );
}

function FreeTierCard() {
  return (
    <div className="rounded-base border-2 border-black shadow-[4px_4px_0px_0px_black] p-6 flex flex-col">
      <div className="mb-6">
        <p className="font-bold text-sm uppercase tracking-wide text-foreground/60 mb-1">
          Free Trial
        </p>
        <p className="font-heading text-3xl mb-1">$0</p>
        <p className="text-sm text-foreground/60">for 25 days</p>
      </div>

      <p className="text-sm text-foreground/70 mb-6 italic">
        "Most tools give you a week. We give you enough time to actually see
        results."
      </p>

      <ul className="space-y-2 mb-8 text-sm flex-1">
        {[
          "1 domain",
          "All 4 platforms: ChatGPT, Claude, Gemini, Perplexity",
          "Daily citation runs for 25 days",
        ].map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <CheckIcon className="size-4 shrink-0 mt-0.5" />
            {feature}
          </li>
        ))}
      </ul>

      <Link
        to="/sign-up"
        className="block text-center rounded-base border-2 border-black bg-white px-4 py-2 font-bold text-sm shadow-[2px_2px_0px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all"
      >
        Start free
      </Link>
    </div>
  );
}

function ProTierCard() {
  return (
    <div className="rounded-base border-2 border-black shadow-[4px_4px_0px_0px_black] p-6 flex flex-col bg-amber-50">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1">
          <p className="font-bold text-sm uppercase tracking-wide text-foreground/60">
            Pro
          </p>
          <span className="text-xs font-bold bg-amber-400 border border-black rounded px-2 py-0.5">
            Popular
          </span>
        </div>
        <p className="font-heading text-3xl mb-1">
          $29<span className="text-base font-normal">/mo</span>
        </p>
        <p className="text-sm text-foreground/60">or $249/year (save $99)</p>
      </div>

      <ul className="space-y-2 mb-8 text-sm flex-1">
        {[
          "Up to 3 domains",
          "All 4 platforms",
          "Daily runs, indefinitely",
          "Full citation history",
          "API access",
          "Email digests and alerts",
          "Benchmark data",
        ].map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <CheckIcon className="size-4 shrink-0 mt-0.5 text-amber-600" />
            {feature}
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2">
        <Link
          to="/sign-up"
          className="block text-center rounded-base border-2 border-black bg-amber-400 px-4 py-2 font-bold text-sm shadow-[2px_2px_0px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all"
        >
          Subscribe monthly
        </Link>
        <Link
          to="/sign-up"
          className="block text-center rounded-base border-2 border-black bg-white px-4 py-2 font-bold text-sm shadow-[2px_2px_0px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all"
        >
          Subscribe yearly
        </Link>
      </div>
    </div>
  );
}

function CustomTierCard() {
  return (
    <div className="rounded-base border-2 border-black shadow-[4px_4px_0px_0px_black] p-6 flex flex-col">
      <div className="mb-6">
        <p className="font-bold text-sm uppercase tracking-wide text-foreground/60 mb-1">
          Custom
        </p>
        <p className="font-heading text-3xl mb-1">Let's talk</p>
        <p className="text-sm text-foreground/60">for agencies</p>
      </div>

      <p className="text-sm text-foreground/70 mb-6 italic">
        "For agencies tracking multiple clients."
      </p>

      <ul className="space-y-2 mb-8 text-sm flex-1">
        {["Unlimited domains", "Everything in Pro", "Priority support"].map(
          (feature) => (
            <li key={feature} className="flex items-start gap-2">
              <CheckIcon className="size-4 shrink-0 mt-0.5" />
              {feature}
            </li>
          ),
        )}
      </ul>

      <a
        href="mailto:hello@cite.me.in"
        className="block text-center rounded-base border-2 border-black bg-white px-4 py-2 font-bold text-sm shadow-[2px_2px_0px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all"
      >
        Contact us
      </a>
    </div>
  );
}
