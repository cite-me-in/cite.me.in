# Pricing Page Design

## Overview

A public `/pricing` page showing three tiers: Free Trial, Pro, and Custom. Accessible without login. Linked from site nav.

## URL & Access

- **Route:** `/pricing`
- **Auth:** Public — no login required
- **Nav:** Add "Pricing" link to site header (visible to all visitors)

## Tier Cards

### Free Trial
- **Label:** Free Trial
- **Price:** $0 for 25 days
- **Tagline:** "Most tools give you a week. We give you enough time to actually see results."
- **Features:** 1 domain, all 4 platforms (ChatGPT, Claude, Gemini, Perplexity), daily runs for 25 days
- **CTA:** "Start free" → `/sign-up`

### Pro
- **Label:** Pro
- **Price:** $29/mo
- **Sub-price:** "or $249/year (save $99)"
- **Features:** 3 domains, daily runs indefinitely, full citation history, API access, email digests, benchmark data
- **CTAs:** "Subscribe monthly" and "Subscribe yearly" → both go to `/sign-up` (Stripe checkout after sign-up/login via `/upgrade`)

### Custom
- **Label:** Custom
- **Price:** "Let's talk"
- **Tagline:** "For agencies tracking multiple clients."
- **Features:** Unlimited domains, everything in Pro, priority support
- **CTA:** "Contact us" → `mailto:hello@cite.me.in`

## Layout

Three side-by-side cards on desktop, stacked vertically on mobile. Pro card is visually highlighted (amber accent) as the recommended tier.

## Out of Scope

- Login-state-aware CTAs (always link to `/sign-up`)
- Annual/monthly toggle (show both price and CTA buttons)
- FAQ section (already exists at `/faq`)
