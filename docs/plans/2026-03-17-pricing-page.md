# Pricing Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Add a public `/pricing` page with Free Trial, Pro, and Custom tier cards, and link to it from site navigation.

**Architecture:** One new route file at `app/routes/pricing/route.tsx`. Nav links added in two places: `LandingNav` in `app/routes/home/route.tsx` (home page has its own nav with `hideHeader: true`) and `HeaderLinks` in `app/components/layout/PageHeader.tsx` (shown on all other public pages when not in site context).

**Tech Stack:** React Router, Tailwind CSS, Lucide React, existing Button/Main UI components

---

### Task 1: Create the /pricing route

**Files:**
- Create: `app/routes/pricing/route.tsx`

**Step 1: Create the file**

```tsx
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
        {[
          "Unlimited domains",
          "Everything in Pro",
          "Priority support",
        ].map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <CheckIcon className="size-4 shrink-0 mt-0.5" />
            {feature}
          </li>
        ))}
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
```

**Step 2: Typecheck**

```bash
pnpm typecheck
```
Expected: no errors

**Step 3: Commit**

```bash
git add app/routes/pricing/
git commit -m "feat: add /pricing page with three tier cards"
```

---

### Task 2: Add Pricing link to navigation

Two places need the link:
1. `LandingNav` in `app/routes/home/route.tsx` — the home page uses `hideHeader: true` and has its own nav
2. `HeaderLinks` in `app/components/layout/PageHeader.tsx` — shown on all non-home public pages when not in app context (FAQ, blog, etc.)

**Files:**
- Modify: `app/routes/home/route.tsx`
- Modify: `app/components/layout/PageHeader.tsx`

**Step 1: Add Pricing to LandingNav**

In `app/routes/home/route.tsx`, find `LandingNav`. Add a "Pricing" link between the logo and auth buttons:

```tsx
function LandingNav({ isSignedIn }: { isSignedIn: boolean }) {
  return (
    <nav className="flex items-center justify-between border-black border-b-2 bg-[hsl(60,100%,99%)] px-6 py-3">
      <CiteMeInLogo />
      <div className="flex items-center gap-6">
        <ActiveLink to="/pricing" variant="link">
          Pricing
        </ActiveLink>
        <div className="flex items-center gap-3">
          {isSignedIn ? (
            <ActiveLink variant="button" to="/sites" size="sm" bg="yellow">
              Dashboard
            </ActiveLink>
          ) : (
            <>
              <ActiveLink variant="button" to="/sign-in" size="sm">
                Sign in
              </ActiveLink>
              <ActiveLink variant="button" to="/sign-up" size="sm" bg="yellow">
                Get started
              </ActiveLink>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
```

Read the actual file first to understand the exact current structure before editing.

**Step 2: Add Pricing to PageHeader public nav**

In `app/components/layout/PageHeader.tsx`, find `HeaderLinks`. When not in a site context, it currently renders nothing. Add a "Pricing" link for the public (no siteNav) case:

```tsx
function HeaderLinks() {
  const matches = useMatches() as UIMatch<unknown, { siteNav?: boolean }>[];
  const navLinks = [];
  const siteMatch = matches.find((m) => m.handle?.siteNav);
  const siteDomain = siteMatch?.params.domain as string | undefined;
  if (siteMatch) navLinks.push({ to: "/sites", label: "Dashboard" });
  if (siteDomain)
    navLinks.push(
      { to: `/site/${siteDomain}/citations`, label: "Citations" },
      { to: `/site/${siteDomain}/queries`, label: "Queries" },
      { to: `/site/${siteDomain}/bots`, label: "Bot Traffic" },
      { to: `/site/${siteDomain}/settings`, label: "Settings" },
    );
  if (!siteMatch) navLinks.push({ to: "/pricing", label: "Pricing" });

  return (
    <nav className="hidden items-center gap-6 whitespace-nowrap md:flex">
      {navLinks.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          className={({ isActive }) =>
            twMerge(
              "whitespace-nowrap font-bold text-base text-black",
              "transition-colors hover:text-[#F59E0B]",
              isActive && "text-[#F59E0B]",
            )
          }
          viewTransition
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}
```

**Step 3: Typecheck**

```bash
pnpm typecheck
```

**Step 4: Commit**

```bash
git add app/routes/home/route.tsx app/components/layout/PageHeader.tsx
git commit -m "feat: add Pricing link to site navigation"
```
