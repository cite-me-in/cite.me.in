import { CheckIcon } from "lucide-react";
import { Link } from "react-router";
import { twMerge } from "tailwind-merge";
import { Badge } from "~/components/ui/Badge";
import { type ButtonProps, buttonVariants } from "~/components/ui/Button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "~/components/ui/Card";
import Main from "~/components/ui/Main";
import prices from "~/data/stripe-prices.json";
import type { Route } from "./+types/route";

export function loader() {
  return prices;
}

export function meta(): Route.MetaDescriptors {
  return [
    { title: "Pricing | Cite.me.in" },
    {
      name: "description",
      content:
        `Start free for 25 days. Upgrade to Pro for $${prices.monthlyAmount}/month to keep your citation history and continue monitoring.`,
    },
  ];
}

export default function PricingPage({ loaderData }: Route.ComponentProps) {
  const { monthlyAmount, annualAmount, annualSavings } = loaderData;
  return (
    <Main className="mx-auto max-w-5xl px-4 py-16">
      <h1 className="mb-4 text-center font-heading text-4xl">Pricing</h1>
      <p className="mx-auto mb-12 max-w-xl text-center text-foreground/70">
        Monitor your brand's AI citation visibility. Start free — no credit card
        required.
      </p>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <FreeTierCard />
        <ProTierCard
          monthlyAmount={monthlyAmount}
          annualAmount={annualAmount}
          annualSavings={annualSavings}
        />
        <CustomTierCard />
      </div>
    </Main>
  );
}

function FreeTierCard() {
  return (
    <TierCard>
      <TierSummary title="Free Trial" price="$0" description="for 25 days" />

      <TierFeatures
        features={[
          "1 domain",
          "All 4 platforms: ChatGPT, Claude, Gemini, Perplexity",
          "We'll monitor citations for you",
        ]}
        description="Most tools give you a week. We give you enough time to actually see results."
        color="text-green-600"
      />

      <TierCTA to="/sign-up" cta="Start free" variant="outline" />
    </TierCard>
  );
}

function ProTierCard({
  monthlyAmount,
  annualAmount,
  annualSavings,
}: {
  monthlyAmount: number;
  annualAmount: number;
  annualSavings: number;
}) {
  return (
    <TierCard variant="yellow">
      <TierSummary
        title="Pro"
        badge="Popular"
        price={`$${monthlyAmount}/mo`}
        description={`or $${annualAmount}/year (save $${annualSavings})`}
      />
      <TierFeatures
        features={[
          "Up to 5 sites",
          "All 4 platforms",
          "We'll monitor citations indefinitely",
          "Full citation history",
          "API access",
          "Email digests and alerts",
          "Benchmark data",
        ]}
        description="For founders building in public"
        color="text-amber-600"
      />

      <TierCTA
        to="/sign-up?next=/upgrade"
        cta="Get started"
        variant="default"
      />
    </TierCard>
  );
}

function CustomTierCard() {
  return (
    <TierCard>
      <TierSummary
        title="Custom"
        price="Let's talk"
        description="for agencies"
      />

      <TierFeatures
        features={["Unlimited sites", "Everything in Pro", "Priority support"]}
        description="For agencies tracking multiple clients."
        color="text-green-600"
      />

      <TierCTA
        to="mailto:hello@cite.me.in"
        cta="Contact us"
        variant="outline"
      />
    </TierCard>
  );
}

function TierCard({
  children,
  variant,
}: {
  children: React.ReactNode;
  variant?: "yellow";
}) {
  return (
    <Card className="flex flex-col" variant={variant}>
      {children}
    </Card>
  );
}

function TierSummary({
  title,
  badge,
  price,
  description,
}: {
  title: string;
  badge?: string;
  price: string;
  description: string;
}) {
  return (
    <CardHeader>
      <div className="mb-1 flex items-center justify-between">
        <p className="font-bold text-foreground/60 text-sm uppercase tracking-wide">
          {title}
        </p>
        {badge && <Badge variant="yellow">{badge}</Badge>}
      </div>
      <p className="mb-1 font-heading text-3xl">{price}</p>
      <p className="text-foreground/60 text-sm">{description}</p>
    </CardHeader>
  );
}

function TierFeatures({
  features,
  description,
  color,
}: {
  features: string[];
  description: string;
  color: string;
}) {
  return (
    <CardContent>
      <p className="mb-6 text-foreground/70 text-sm italic">{description}</p>

      <ul className="mb-8 flex-1 space-y-2 text-sm">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <CheckIcon className={twMerge("mt-0.5 size-4 shrink-0", color)} />
            {feature}
          </li>
        ))}
      </ul>
    </CardContent>
  );
}

function TierCTA({
  to,
  cta,
  variant,
}: {
  to: string;
  cta: string;
  variant: ButtonProps["variant"];
}) {
  return (
    <CardFooter className="mt-auto flex">
      <Link
        to={to}
        className={twMerge(
          buttonVariants({ variant }),
          "w-full justify-center",
        )}
      >
        {cta}
      </Link>
    </CardFooter>
  );
}
