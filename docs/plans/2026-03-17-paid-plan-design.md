# Paid Plan Design

## Overview

Add a Pro subscription plan ($29/mo or $249/year) to convert free trial users into paying customers. The free trial runs for 25 days — deliberately longer than industry standard — after which daily runs stop unless the user upgrades. The primary reason to pay is preserving and continuing to grow citation history. Secondary reasons: API access, email digests, benchmarks, and supporting an indie developer.

## Value Proposition

**Upfront (marketing copy):**
> "25 days free, no credit card. Most tools give you a week — we give you enough time to actually see results."

The 25-day trial is framed as generosity, not a conversion tactic. The data argument is reserved for the conversion moment.

**At day 25 (conversion copy):**
> "You've tracked [N] citations across [N] queries. Upgrade to keep your history and continue daily runs."

Show the user what they built. Let the data sell itself.

**Indie maker angle (one line on pricing page):**
> "cite.me.in is built by one person. Your $29/mo is what keeps it independent, updated, and not acquired by someone with a worse product vision."

Not a guilt trip — a smile and a good feeling. Founders understand the hustle.

**Open-source trust signal (context, not sales):**
> cite.me.in is open-source. If we ever shut down, you take the code and run it yourself.

## Tier Structure

| | Free | Pro |
|---|---|---|
| Domains | 1 | 3 |
| Platforms | All 4 (ChatGPT, Claude, Gemini, Perplexity) | All 4 |
| Daily runs | 25 days | Indefinitely |
| Citation history | 25 days | Forever |
| API access | — | Yes |
| Email digests & alerts | — | Yes |
| Network benchmarks | — | Yes |
| Price | $0 | $29/mo or $249/yr |

**Why 3 domains for Pro:** Covers founders with multiple projects; stops agencies from using a single plan to service many clients (they'd need a custom arrangement).

**Why $29/mo:** Low enough for a solo founder, high enough to signal a real product (not a side project). The annual option ($249/yr ≈ $20/mo) rewards commitment and provides upfront cash for LLM operating costs.

## Upgrade Flow

### Always available (day 1+)

- Quiet "Upgrade to Pro" link in sidebar — not a banner, always present
- `/upgrade` page with pricing table, feature comparison, maker paragraph, and Stripe checkout

### Day 23 — heads-up email

Subject: "Your cite.me.in trial ends in 2 days"

Friendly, no urgency language, no countdown. Show current stats. One CTA to upgrade.

### Day 25 — conversion moment

**In-app banner** (appears when runs stop):
> "Your 25-day trial has ended. You've tracked [N] citations across [N] queries. Upgrade to keep your history and continue daily runs."

**Email** (sent same day):

Subject: "Your cite.me.in data is waiting"

Not "trial expired" — lead with what they built. One CTA.

### Checkout

- Stripe hosted checkout
- Monthly / annual toggle
- After payment: instant access, history preserved, runs resume same night

## What We Don't Say

- No "unlock premium features" framing — data preservation is the honest hook
- No urgency language, countdown timers, or "limited time" copy
- Don't explain the conversion logic upfront — the data does the selling at the right moment

## Out of Scope

- Agency/team plans
- Per-domain pricing
- Grandfathering founding member pricing (keep it simple for now)
- Trial extensions (can be done manually for edge cases)
