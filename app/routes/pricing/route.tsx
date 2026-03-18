import { CheckIcon } from "lucide-react";
import { Link } from "react-router";
import { buttonVariants } from "~/components/ui/Button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "~/components/ui/Card";
import Main from "~/components/ui/Main";
import envVars from "~/lib/envVars";
import type { Route } from "./+types/route";

export function meta(): Route.MetaDescriptors {
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
      <div className="mx-auto max-w-5xl px-4 py-16">
        <h1 className="mb-4 text-center font-heading text-4xl">Pricing</h1>
        <p className="mx-auto mb-12 max-w-xl text-center text-foreground/70">
          Monitor your brand's AI citation visibility. Start free — no credit
          card required.
        </p>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
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
    <Card className="flex flex-col">
      <CardHeader>
        <p className="mb-1 font-bold text-foreground/60 text-sm uppercase tracking-wide">
          Free Trial
        </p>
        <p className="mb-1 font-heading text-3xl">$0</p>
        <p className="text-foreground/60 text-sm">for 25 days</p>
      </CardHeader>

      <CardContent>
        <p className="mb-6 text-foreground/70 text-sm italic">
          "Most tools give you a week. We give you enough time to actually see
          results."
        </p>

        <ul className="mb-8 flex-1 space-y-2 text-sm">
          {[
            "1 domain",
            "All 4 platforms: ChatGPT, Claude, Gemini, Perplexity",
            "We'll monitor citations for you",
          ].map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <CheckIcon className="mt-0.5 size-4 shrink-0" />
              {feature}
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter className="mt-auto flex">
        <Link
          to="/sign-up"
          className={buttonVariants({
            variant: "outline",
            size: "sm",
            className: "w-full justify-center",
          })}
        >
          Start free
        </Link>
      </CardFooter>
    </Card>
  );
}

function ProTierCard() {
  return (
    <Card className="flex flex-col" variant="yellow">
      <CardHeader>
        <div className="mb-1 flex items-center justify-between">
          <p className="font-bold text-foreground/60 text-sm uppercase tracking-wide">
            Pro
          </p>
          <span className="rounded border border-black bg-amber-400 px-2 py-0.5 font-bold text-xs">
            Popular
          </span>
        </div>
        <p className="mb-1 font-heading text-3xl">
          $29<span className="font-normal text-base">/mo</span>
        </p>
        <p className="text-foreground/60 text-sm">or $249/year (save $99)</p>
      </CardHeader>

      <CardContent>
        <ul className="mb-8 flex-1 space-y-2 text-sm">
          {[
            "Up to 3 domains",
            "All 4 platforms",
            "We'll monitor citations indefinitely",
            "Full citation history",
            "API access",
            "Email digests and alerts",
            "Benchmark data",
          ].map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <CheckIcon className="mt-0.5 size-4 shrink-0 text-amber-600" />
              {feature}
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter className="mt-auto flex">
        <Link
          to="/sign-up?next=/upgrade"
          className={buttonVariants({
            variant: "default",
            size: "sm",
            className: "w-full justify-center",
          })}
        >
          Get started
        </Link>
      </CardFooter>
    </Card>
  );
}

function CustomTierCard() {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <p className="mb-1 font-bold text-foreground/60 text-sm uppercase tracking-wide">
          Custom
        </p>
        <p className="mb-1 font-heading text-3xl">Let's talk</p>
        <p className="text-foreground/60 text-sm">for agencies</p>
      </CardHeader>

      <CardContent>
        <p className="mb-6 text-foreground/70 text-sm italic">
          "For agencies tracking multiple clients."
        </p>

        <ul className="mb-8 flex-1 space-y-2 text-sm">
          {["Unlimited domains", "Everything in Pro", "Priority support"].map(
            (feature) => (
              <li key={feature} className="flex items-start gap-2">
                <CheckIcon className="mt-0.5 size-4 shrink-0" />
                {feature}
              </li>
            ),
          )}
        </ul>
      </CardContent>

      <CardFooter className="mt-auto flex">
        <Link
          to={`mailto:${envVars.VITE_EMAIL_FROM}`}
          className={buttonVariants({
            variant: "outline",
            size: "sm",
            className: "w-full justify-center",
          })}
        >
          Contact us
        </Link>
      </CardFooter>
    </Card>
  );
}
