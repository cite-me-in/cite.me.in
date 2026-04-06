# Tiered Access Design

## Overview

Introduce four explicit access tiers — `trial`, `paid`, `cancelled`, `gratis` — stored as a `plan` enum on the `User` model. All tier-based decisions (processing eligibility, digest eligibility, processing frequency) flow through one central module: `app/lib/userPlan.server.ts`.

## Tiers

| Tier      | Processing     | Weekly digest | Requires subscription |
|-----------|---------------|---------------|-----------------------|
| trial     | Once per week, stops after 25 days | Yes, stops after 25 days | No |
| paid      | Once per day  | Yes           | Yes (Stripe)          |
| cancelled | None          | No            | —                     |
| gratis    | Once per day  | Yes           | No (manually granted) |

Setting a user to gratis: `UPDATE users SET plan = 'gratis' WHERE email = '...'`

## Schema changes

### Add `Plan` enum and `User.plan`

```prisma
enum Plan {
  trial      // First 25 days — weekly processing and digest, then stops
  paid       // Active subscription — daily processing, weekly digest
  cancelled  // Subscription ended — no processing, no digest
  gratis     // Manually granted — daily processing, weekly digest, no subscription required
}

model User {
  plan Plan @default(trial)
  // ... existing fields
}
```

### Add `Site.lastProcessedAt`

Decouples "when was a citation run done" from `digestSentAt` ("when was the digest email sent"). The cron previously conflated these — all processing was gated behind `digestSentAt < 7 days ago`, preventing daily runs for paid users.

```prisma
model Site {
  lastProcessedAt DateTime? @map("last_processed_at")
  // ... existing fields
}
```

### Remove `Account.status`

`User.plan` is now the single authoritative source of truth. `Account` becomes a pure Stripe metadata store (`stripeCustomerId`, `stripeSubscriptionId`, `interval`).

### Backfill migration

```sql
ALTER TABLE users ADD COLUMN plan plan NOT NULL DEFAULT 'trial';

UPDATE users u
SET plan = CASE
  WHEN a.status = 'active'    THEN 'paid'::plan
  WHEN a.status = 'cancelled' THEN 'cancelled'::plan
  ELSE                             'trial'::plan
END
FROM accounts a
WHERE a.user_id = u.id;

ALTER TABLE accounts DROP COLUMN status;
```

## Central tier logic: `app/lib/userPlan.server.ts`

All plan-based decisions live here. No other file contains tier logic.

```ts
export type Plan = "trial" | "paid" | "cancelled" | "gratis";
export const TRIAL_DAYS = 25;

// How often a site should be processed per tier.
export function processingIntervalHours(plan: Plan): number {
  if (plan === "trial") return 7 * 24;
  if (plan === "paid" || plan === "gratis") return 24;
  return Infinity; // cancelled
}

// Whether a site should be processed right now.
// Trial expires after 25 days.
export function isProcessingEligible(user: { plan: Plan; createdAt: Date }): boolean {
  if (user.plan === "cancelled") return false;
  if (user.plan === "trial") return daysSince(user.createdAt) < TRIAL_DAYS;
  return true; // paid, gratis
}

// Whether to include this site in the weekly digest.
// Same eligibility as processing.
export function isDigestEligible(user: { plan: Plan; createdAt: Date }): boolean {
  return isProcessingEligible(user);
}
```

## Processing pipeline (`prepareSites`)

The Prisma query filters by plan and trial age at the DB level, then the in-memory filter applies the per-tier `lastProcessedAt` interval:

```ts
// DB query: only eligible owners
where: {
  owner: {
    OR: [
      { plan: { in: ["paid", "gratis"] } },
      { plan: "trial", createdAt: { gte: daysAgo(TRIAL_DAYS) } },
    ],
  },
},

// In-memory: only sites due for processing
const due = sites.filter((site) => {
  if (!isProcessingEligible(site.owner)) return false;
  const intervalMs = processingIntervalHours(site.owner.plan) * 3_600_000;
  return Date.now() - (site.lastProcessedAt ?? new Date(0)).getTime() >= intervalMs;
});
```

After processing, `lastProcessedAt` is set to `now()`. `digestSentAt` is only updated when the digest email is actually sent. The cron schedule remains hourly — no second cron needed.

## Stripe webhook (`api.stripe.webhook.ts`)

**`checkout.session.completed`** — set `User.plan = "paid"` and upsert Account for Stripe metadata:

```ts
await prisma.$transaction([
  prisma.user.update({ where: { id: userId }, data: { plan: "paid" } }),
  prisma.account.upsert({ ... }), // stripeCustomerId, stripeSubscriptionId, interval
]);
```

**`customer.subscription.deleted`** — set `User.plan = "cancelled"` and emit webhook notification (currently missing):

```ts
await prisma.user.update({ where: { id: account.userId }, data: { plan: "cancelled" } });
await emitWebhookEvent("subscription.cancelled", { userId: account.userId });
```

**21-day payment failure rule** — configure in Stripe dashboard: *Subscriptions → Settings → Manage failed payments → Cancel after 21 days*. This fires `customer.subscription.deleted` which the code already handles. No custom logic needed.

## Callsites to update

| File | Change |
|------|--------|
| `app/lib/sites.server.ts` | `isPro = user.plan === "paid" \|\| user.plan === "gratis"` |
| `app/routes/api.admin.users.ts` | `status: user.plan`; update Zod enum |
| `app/emails/TrialEnded.tsx` | Query `plan: "trial"` users past 25 days |
| `app/emails/TrialEnding.tsx` | Query `plan: "trial"` users approaching 25 days |
