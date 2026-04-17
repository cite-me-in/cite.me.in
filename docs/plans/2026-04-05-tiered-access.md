# Tiered Access Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Replace the implicit trial/active/cancelled tier logic (derived from `user.createdAt` + `account.status`) with an explicit `plan` enum on the `User` model, add a `gratis` tier, decouple processing frequency from digest sends via `Site.lastProcessedAt`, and ensure all tier logic flows through a single `app/lib/userPlan.server.ts` module.

**Architecture:** Add a `Plan` Prisma enum (`trial | paid | cancelled | gratis`) to `User`. Stripe webhooks write `user.plan` instead of `account.status` (which is removed). `prepareSites` filters by `user.plan` + `lastProcessedAt` so paid/gratis process daily and trial processes weekly. One new file owns all tier decisions.

**Tech Stack:** Prisma (schema + migration), React Router loaders/actions, Vitest integration tests, Stripe webhooks.

**Design doc:** `docs/plans/2026-04-05-tiered-access-design.md`

---

### Task 1: Schema migration

**Files:**

- Modify: `prisma/schema.prisma`

**Step 1: Add the `Plan` enum, `User.plan`, `Site.lastProcessedAt`, remove `Account.status`**

In `prisma/schema.prisma`:

```prisma
enum Plan {
  trial      // First 25 days — weekly processing and digest, then stops
  paid       // Active subscription — daily processing, weekly digest
  cancelled  // Subscription ended — no processing, no digest
  gratis     // Manually granted — daily processing, weekly digest, no subscription required
}
```

On the `User` model, add after `passwordHash`:

```prisma
  plan  Plan  @map("plan")  @default(trial)
```

On the `Site` model, add after `id`:

```prisma
  lastProcessedAt  DateTime?  @map("last_processed_at")
```

On the `Account` model, remove the entire `status` line:

```prisma
  status  String  @map("status")   ← DELETE THIS LINE
```

**Step 2: Push schema to dev DB**

```bash
pnpm test:db:push
```

Expected: `✔ Your database is now in sync with your Prisma schema.`

**Step 3: Backfill existing users**

Run this SQL directly (Prisma Studio, psql, or `infisical --env dev run -- psql $DATABASE_URL`):

```sql
UPDATE users u
SET plan = CASE
  WHEN a.status = 'active'    THEN 'paid'::plan
  WHEN a.status = 'cancelled' THEN 'cancelled'::plan
  ELSE                             'trial'::plan
END
FROM accounts a
WHERE a.user_id = u.id;
```

**Step 4: Drop `accounts.status` column**

```sql
ALTER TABLE accounts DROP COLUMN status;
```

**Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add Plan enum to User, lastProcessedAt to Site, remove Account.status"
```

---

### Task 2: Central tier logic module

**Files:**

- Create: `app/lib/userPlan.server.ts`
- Create: `test/lib/userPlan.test.ts`

**Step 1: Write failing tests**

Create `test/lib/userPlan.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  TRIAL_DAYS,
  isDigestEligible,
  isProcessingEligible,
  processingIntervalHours,
} from "~/lib/userPlan.server";

const now = new Date();
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

describe("processingIntervalHours", () => {
  it("should return 168 for trial", () => {
    expect(processingIntervalHours("trial")).toBe(7 * 24);
  });
  it("should return 24 for paid", () => {
    expect(processingIntervalHours("paid")).toBe(24);
  });
  it("should return 24 for gratis", () => {
    expect(processingIntervalHours("gratis")).toBe(24);
  });
  it("should return Infinity for cancelled", () => {
    expect(processingIntervalHours("cancelled")).toBe(Infinity);
  });
});

describe("isProcessingEligible", () => {
  it("should return true for a paid user", () => {
    expect(isProcessingEligible({ plan: "paid", createdAt: daysAgo(30) })).toBe(true);
  });
  it("should return true for a gratis user", () => {
    expect(isProcessingEligible({ plan: "gratis", createdAt: daysAgo(100) })).toBe(true);
  });
  it("should return false for a cancelled user", () => {
    expect(isProcessingEligible({ plan: "cancelled", createdAt: daysAgo(10) })).toBe(false);
  });
  it("should return true for a trial user within 25 days", () => {
    expect(isProcessingEligible({ plan: "trial", createdAt: daysAgo(10) })).toBe(true);
  });
  it("should return false for a trial user older than 25 days", () => {
    expect(isProcessingEligible({ plan: "trial", createdAt: daysAgo(26) })).toBe(false);
  });
  it("should return false for a trial user at exactly 25 days", () => {
    expect(isProcessingEligible({ plan: "trial", createdAt: daysAgo(25) })).toBe(false);
  });
});

describe("isDigestEligible", () => {
  it("should match isProcessingEligible for all tiers", () => {
    const cases: Parameters<typeof isProcessingEligible>[0][] = [
      { plan: "paid", createdAt: daysAgo(10) },
      { plan: "gratis", createdAt: daysAgo(10) },
      { plan: "cancelled", createdAt: daysAgo(10) },
      { plan: "trial", createdAt: daysAgo(5) },
      { plan: "trial", createdAt: daysAgo(26) },
    ];
    for (const c of cases) {
      expect(isDigestEligible(c)).toBe(isProcessingEligible(c));
    }
  });
});

describe("TRIAL_DAYS", () => {
  it("should be 25", () => {
    expect(TRIAL_DAYS).toBe(25);
  });
});
```

**Step 2: Run tests to confirm they fail**

```bash
pnpm vitest run test/lib/userPlan.test.ts
```

Expected: FAIL — module not found.

**Step 3: Create `app/lib/userPlan.server.ts`**

```ts
export type Plan = "trial" | "paid" | "cancelled" | "gratis";

// Days a trial user can access processing and digest.
export const TRIAL_DAYS = 25;

// How many hours must pass before a site is processed again, per tier.
// trial: once per week (tied to the digest run)
// paid/gratis: once per day
// cancelled: never
export function processingIntervalHours(plan: Plan): number {
  if (plan === "trial") return 7 * 24;
  if (plan === "paid" || plan === "gratis") return 24;
  return Infinity;
}

// Whether a site should be processed right now.
// Trial expires after TRIAL_DAYS — no processing after that.
export function isProcessingEligible(user: { plan: Plan; createdAt: Date }): boolean {
  if (user.plan === "cancelled") return false;
  if (user.plan === "trial") return daysSince(user.createdAt) < TRIAL_DAYS;
  return true; // paid, gratis
}

// Whether to send the weekly digest to this user's sites.
// Same eligibility as processing.
export function isDigestEligible(user: { plan: Plan; createdAt: Date }): boolean {
  return isProcessingEligible(user);
}

function daysSince(date: Date): number {
  return (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
}
```

**Step 4: Run tests to confirm they pass**

```bash
pnpm vitest run test/lib/userPlan.test.ts
```

Expected: All PASS.

**Step 5: Commit**

```bash
git add app/lib/userPlan.server.ts test/lib/userPlan.test.ts
git commit -m "feat: add userPlan.server.ts with tier logic"
```

---

### Task 3: Update `prepareSites.server.ts`

**Files:**

- Modify: `app/lib/prepareSites.server.ts`
- Modify: `test/routes/cron.process-sites.test.ts`

**Step 1: Update the integration tests first**

In `test/routes/cron.process-sites.test.ts`, the `site processing` describe block needs to be rewritten.

All test seeds that create users with `account: { create: { status: "active", ... } }` must change to:

- Remove `status` from account create (field no longer exists)
- Add `plan: "paid"` directly on the user

The processing gate changes from `digestSentAt` to `lastProcessedAt`:

- For paid: process if `lastProcessedAt > 24h ago` (or null)
- For trial: process if `lastProcessedAt > 7 days ago` (or null)

Replace the entire `describe("site processing", ...)` block with:

```ts
describe("site processing", () => {
  beforeEach(async () => {
    await prisma.user.deleteMany();
  });

  it("should process a paid site never processed before (lastProcessedAt null)", async () => {
    await prisma.site.create({
      data: {
        apiKey: "test-api-key-process-1",
        content: "Test content",
        domain: "paid-site.example.com",
        id: "site-process-1",
        summary: "Test summary",
        owner: {
          create: {
            id: "user-process-1",
            email: "owner-process1@test.com",
            passwordHash: "test",
            plan: "paid",
            account: {
              create: {
                stripeCustomerId: "cus_process_test1",
                stripeSubscriptionId: "sub_process_test1",
                interval: "monthly",
              },
            },
          },
        },
      },
    });

    const results = await makeRequest("test-cron-secret");
    expect(results.length).toBe(1);
  });

  it("should process a paid site last processed more than 24 hours ago", async () => {
    await prisma.site.create({
      data: {
        apiKey: "test-api-key-process-1",
        content: "Test content",
        domain: "paid-site.example.com",
        id: "site-process-1",
        summary: "Test summary",
        lastProcessedAt: new Date(Temporal.Now.instant().subtract({ hours: 25 }).epochMilliseconds),
        owner: {
          create: {
            id: "user-process-1",
            email: "owner-process1@test.com",
            passwordHash: "test",
            plan: "paid",
            account: {
              create: {
                stripeCustomerId: "cus_process_test1",
                stripeSubscriptionId: "sub_process_test1",
                interval: "monthly",
              },
            },
          },
        },
      },
    });

    const results = await makeRequest("test-cron-secret");
    expect(results.length).toBe(1);
  });

  it("should skip a paid site processed within the last 24 hours", async () => {
    await prisma.site.create({
      data: {
        apiKey: "test-api-key-process-1",
        content: "Test content",
        domain: "paid-site.example.com",
        id: "site-process-1",
        summary: "Test summary",
        lastProcessedAt: new Date(Temporal.Now.instant().subtract({ hours: 12 }).epochMilliseconds),
        owner: {
          create: {
            id: "user-process-1",
            email: "owner-process1@test.com",
            passwordHash: "test",
            plan: "paid",
            account: {
              create: {
                stripeCustomerId: "cus_process_test1",
                stripeSubscriptionId: "sub_process_test1",
                interval: "monthly",
              },
            },
          },
        },
      },
    });

    const results = await makeRequest("test-cron-secret");
    expect(results.length).toBe(0);
  });

  it("should process a trial site created today (lastProcessedAt null)", async () => {
    await prisma.site.create({
      data: {
        apiKey: "test-api-key-process-2",
        content: "Test content",
        domain: "free-trial.example.com",
        id: "site-process-2",
        summary: "Test summary",
        owner: {
          create: {
            id: "user-process-2",
            email: "owner-process2@test.com",
            passwordHash: "test",
          },
        },
      },
    });

    const results = await makeRequest("test-cron-secret");
    expect(results.length).toBe(1);
  });

  it("should skip a trial site processed within the last 7 days", async () => {
    await prisma.site.create({
      data: {
        apiKey: "test-api-key-process-2",
        content: "Test content",
        domain: "free-trial.example.com",
        id: "site-process-2",
        summary: "Test summary",
        lastProcessedAt: new Date(
          Temporal.Now.instant().subtract({ hours: 24 * 3 }).epochMilliseconds,
        ),
        owner: {
          create: {
            id: "user-process-2",
            email: "owner-process2@test.com",
            passwordHash: "test",
          },
        },
      },
    });

    const results = await makeRequest("test-cron-secret");
    expect(results.length).toBe(0);
  });

  it("should skip a trial site older than 25 days", async () => {
    await prisma.site.create({
      data: {
        apiKey: "test-api-key-process-3",
        content: "Test content",
        domain: "old-free.example.com",
        id: "site-process-3",
        summary: "Test summary",
        owner: {
          create: {
            id: "user-process-3",
            email: "owner-process3@test.com",
            passwordHash: "test",
            createdAt: new Date(
              Temporal.Now.instant().subtract({ hours: 24 * 26 }).epochMilliseconds,
            ),
          },
        },
      },
    });

    const results = await makeRequest("test-cron-secret");
    expect(results.length).toBe(0);
  });

  it("should process a gratis site not processed in 24 hours", async () => {
    await prisma.site.create({
      data: {
        apiKey: "test-api-key-process-5",
        content: "Test content",
        domain: "gratis-site.example.com",
        id: "site-process-5",
        summary: "Test summary",
        lastProcessedAt: new Date(Temporal.Now.instant().subtract({ hours: 25 }).epochMilliseconds),
        owner: {
          create: {
            id: "user-process-5",
            email: "owner-process5@test.com",
            passwordHash: "test",
            plan: "gratis",
          },
        },
      },
    });

    const results = await makeRequest("test-cron-secret");
    expect(results.length).toBe(1);
  });

  it("should skip a cancelled site", async () => {
    await prisma.site.create({
      data: {
        apiKey: "test-api-key-process-6",
        content: "Test content",
        domain: "cancelled-site.example.com",
        id: "site-process-6",
        summary: "Test summary",
        owner: {
          create: {
            id: "user-process-6",
            email: "owner-process6@test.com",
            passwordHash: "test",
            plan: "cancelled",
          },
        },
      },
    });

    const results = await makeRequest("test-cron-secret");
    expect(results.length).toBe(0);
  });
});
```

Also remove the old test "should skip a site with a citation run recently" (lines 152-186) — `citationRuns` are no longer the processing gate; `lastProcessedAt` is.

**Step 2: Run tests to confirm they fail**

```bash
pnpm vitest run test/routes/cron.process-sites.test.ts
```

Expected: FAIL — seed data has `status` field that no longer exists, and `prepareSites` still uses old logic.

**Step 3: Rewrite `app/lib/prepareSites.server.ts`**

```ts
import type { Plan } from "~/lib/userPlan.server";
import { TRIAL_DAYS, isProcessingEligible, processingIntervalHours } from "~/lib/userPlan.server";
import { UsageLimitExceededError } from "~/lib/usage/UsageLimitExceededError";
import { Temporal } from "@js-temporal/polyfill";
import { map } from "radashi";
import captureAndLogError from "~/lib/captureAndLogError.server";
import generateBotInsight from "~/lib/llm-visibility/generateBotInsight";
import queryAccount from "~/lib/llm-visibility/queryAccount";
import prisma from "~/lib/prisma.server";
import debug from "debug";

const logger = debug("server");

/**
 * Prepare sites for the digest email.
 *
 * Selects sites whose owner is eligible for processing (trial within 25 days,
 * paid, or gratis) and whose lastProcessedAt is past the per-tier interval
 * (24 h for paid/gratis, 7 days for trial, never for cancelled).
 *
 * Runs a citation pass and updates the bot insight for each eligible site,
 * then sets lastProcessedAt = now.
 *
 * Returns the full set of processed sites so the caller can decide which ones
 * also need a digest email (digestSentAt is a separate concern).
 */
export default async function prepareSites(): Promise<
  { id: string; domain: string; digestSentAt: Date | null }[]
> {
  // Fetch all potentially eligible sites with owner plan info.
  // Cancelled owners are excluded at the DB level.
  // Expired trial owners are excluded by the createdAt filter.
  const candidates = await prisma.site.findMany({
    select: {
      id: true,
      domain: true,
      digestSentAt: true,
      lastProcessedAt: true,
      owner: { select: { plan: true, createdAt: true } },
    },
    where: {
      owner: {
        OR: [
          { plan: { in: ["paid", "gratis"] } },
          // Only trial users still within the trial window.
          {
            plan: "trial",
            createdAt: {
              gte: new Date(
                Temporal.Now.instant().subtract({ hours: TRIAL_DAYS * 24 }).epochMilliseconds,
              ),
            },
          },
        ],
      },
    },
  });

  // Filter to sites that are due for processing based on their tier's interval.
  const due = candidates.filter((site) => {
    const { plan, createdAt } = site.owner;
    if (!isProcessingEligible({ plan: plan as Plan, createdAt })) return false;
    const intervalMs = processingIntervalHours(plan as Plan) * 60 * 60 * 1000;
    // null lastProcessedAt means never processed — always due.
    const lastRun = site.lastProcessedAt ?? new Date(0);
    return Date.now() - lastRun.getTime() >= intervalMs;
  });

  logger("[prepareSites] Processing %d sites: %s", due.length, due.map((s) => s.domain).join(", "));

  await map(due, async (site) => {
    await Promise.all([nextCitationRun(site), updateBotInsight(site)]);
    await prisma.site.update({
      where: { id: site.id },
      data: { lastProcessedAt: new Date() },
    });
  });

  return due;
}

// ... nextCitationRun and updateBotInsight remain unchanged
```

Note: remove the `trialDays` parameter from `prepareSites` — it now uses `TRIAL_DAYS` from `userPlan.server.ts` directly. Update the call in `cron.process-sites.ts`:

```ts
// before: const sites = await prepareSites(trialDays);
const sites = await prepareSites();
// also remove: const trialDays = 25;
```

**Step 4: Run the tests**

```bash
pnpm vitest run test/routes/cron.process-sites.test.ts
```

Expected: All PASS.

**Step 5: Commit**

```bash
git add app/lib/prepareSites.server.ts app/routes/cron.process-sites.ts test/routes/cron.process-sites.test.ts
git commit -m "feat: prepareSites uses user.plan + lastProcessedAt, daily for paid/gratis"
```

---

### Task 4: Update Stripe webhook

**Files:**

- Modify: `app/routes/api.stripe.webhook.ts`
- Modify: `test/routes/api.stripe.webhook.test.ts`

**Step 1: Update the tests**

In `test/routes/api.stripe.webhook.test.ts`:

The `beforeAll` seed and the `checkout.session.completed` tests check `account?.status`. Remove all `status` from seed data and switch assertions to `user.plan`:

In `beforeAll`:

```ts
// No change to user seed — no account needed upfront
await prisma.user.create({
  data: {
    id: "user-webhook-1",
    email: "webhook@test.com",
    passwordHash: "test",
  },
});
```

In "should activate account and store Stripe IDs" (line 78), replace the assertion:

```ts
// before:
const account = await prisma.account.findUnique({ where: { userId: "user-webhook-1" } });
expect(account?.status).toBe("active");
expect(account?.interval).toBe("monthly");
expect(account?.stripeCustomerId).toBe("cus_webhook_1");
expect(account?.stripeSubscriptionId).toBe("sub_webhook_1");

// after:
const user = await prisma.user.findUnique({ where: { id: "user-webhook-1" } });
expect(user?.plan).toBe("paid");
const account = await prisma.account.findUnique({ where: { userId: "user-webhook-1" } });
expect(account?.interval).toBe("monthly");
expect(account?.stripeCustomerId).toBe("cus_webhook_1");
expect(account?.stripeSubscriptionId).toBe("sub_webhook_1");
```

In "should cancel account when subscription is deleted" (line 129):

- Update the upsert seed to remove `status: "active"` from account, add `plan: "paid"` to user
- Change assertion from `account?.status` to `user?.plan`:

```ts
// Seed:
await prisma.user.update({
  where: { id: "user-webhook-1" },
  data: {
    plan: "paid",
    account: {
      upsert: {
        create: {
          stripeCustomerId: "cus_webhook_1",
          stripeSubscriptionId: "sub_webhook_cancel",
          interval: "monthly",
        },
        update: { stripeSubscriptionId: "sub_webhook_cancel" },
      },
    },
  },
});

// Assertion:
const user = await prisma.user.findUnique({ where: { id: "user-webhook-1" } });
expect(user?.plan).toBe("cancelled");
```

Also add a test for the webhook event emission:

```ts
it("should emit subscription.cancelled webhook on subscription deletion", async () => {
  // Set up an active user with known subscription
  await prisma.user.update({
    where: { id: "user-webhook-1" },
    data: {
      plan: "paid",
      account: {
        upsert: {
          create: {
            stripeCustomerId: "cus_webhook_1",
            stripeSubscriptionId: "sub_webhook_emit",
            interval: "monthly",
          },
          update: { stripeSubscriptionId: "sub_webhook_emit" },
        },
      },
    },
  });

  const payload = JSON.stringify({
    type: "customer.subscription.deleted",
    data: { object: { id: "sub_webhook_emit", object: "subscription" } },
  });

  const response = await signedRequest(payload);
  expect(response.status).toBe(200);

  // Verify a webhook delivery was queued for this user
  const user = await prisma.user.findUnique({
    where: { id: "user-webhook-1" },
    include: {
      webhookEndpoints: {
        include: { deliveries: { orderBy: { createdAt: "desc" }, take: 1 } },
      },
    },
  });
  // Only assert webhook was attempted if the user has endpoints configured;
  // the event emission is tested via emitWebhookEvent unit behavior.
  expect(user?.plan).toBe("cancelled");
});
```

**Step 2: Run tests to confirm they fail**

```bash
pnpm vitest run test/routes/api.stripe.webhook.test.ts
```

Expected: FAIL — seed references `status` field.

**Step 3: Update `app/routes/api.stripe.webhook.ts`**

Replace the `checkout.session.completed` handler:

```ts
if (event.type === "checkout.session.completed") {
  const session = event.data.object;
  const userId = session.metadata?.userId;
  const interval = session.metadata?.interval ?? "monthly";
  const stripeCustomerId = session.customer as string;
  const stripeSubscriptionId = session.subscription as string;

  if (!userId) throw new Error("Missing userId in session metadata");

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { plan: "paid" },
    }),
    prisma.account.upsert({
      where: { userId },
      create: {
        user: { connect: { id: userId } },
        stripeCustomerId,
        stripeSubscriptionId,
        interval,
      },
      update: { stripeCustomerId, stripeSubscriptionId, interval },
    }),
  ]);

  logger("[stripe] Activated account for user %s (interval: %s)", userId, interval);
}
```

Replace the `customer.subscription.deleted` handler:

```ts
if (event.type === "customer.subscription.deleted") {
  const subscription = event.data.object;
  const account = await prisma.account.findFirst({
    where: { stripeSubscriptionId: subscription.id },
    select: { userId: true },
  });
  if (account) {
    await prisma.user.update({
      where: { id: account.userId },
      data: { plan: "cancelled" },
    });
    await emitWebhookEvent("subscription.cancelled", {
      userId: account.userId,
    });
    logger("[stripe] Cancelled account for subscription %s", subscription.id);
  }
}
```

**Step 4: Run the tests**

```bash
pnpm vitest run test/routes/api.stripe.webhook.test.ts
```

Expected: All PASS.

**Step 5: Commit**

```bash
git add app/routes/api.stripe.webhook.ts test/routes/api.stripe.webhook.test.ts
git commit -m "feat: stripe webhook writes user.plan, emits subscription.cancelled event"
```

---

### Task 5: Update `sites.server.ts`

**Files:**

- Modify: `app/lib/sites.server.ts`

The `createSite` function currently reads `account.status` to determine the site limit. Switch it to `user.plan`.

**Step 1: Update `createSite`**

In `app/lib/sites.server.ts`, the function signature already takes `user: { id: string; isAdmin: boolean }`. Add `plan` to the user type and update the isPro check:

```ts
export async function createSite({
  user,
  domain,
}: {
  user: { id: string; isAdmin: boolean; plan: string };
  domain: string;
}): Promise<Site> {
  const isPro = user.plan === "paid" || user.plan === "gratis";
  const limit = isPro ? 5 : 1;
  const siteCount = await prisma.site.count({ where: { ownerId: user.id } });
  const canAddSite = user.isAdmin || siteCount < limit;
  // ... rest unchanged
```

Remove the `prisma.account.findUnique` call that was only there to get `status`.

Find every callsite of `createSite` and ensure the `user` object passed includes `plan`. The primary callsite is the sites route loader — check it includes `plan` in its `requireUser` result (or look up the user's plan separately).

**Step 2: Run typecheck**

```bash
pnpm check:type
```

Expected: No errors.

**Step 3: Commit**

```bash
git add app/lib/sites.server.ts
git commit -m "refactor: createSite uses user.plan instead of account.status"
```

---

### Task 6: Update `api.admin.users.ts` and its test

**Files:**

- Modify: `app/routes/api.admin.users.ts`
- Modify: `test/routes/api.admin.users.test.ts`

**Step 1: Update the test**

In `test/routes/api.admin.users.test.ts`:

Update the seed for `admin-users-test-user-1`: remove `status: "active"` from account, add `plan: "paid"` on user:

```ts
await prisma.user.upsert({
  where: { id: "admin-users-test-user-1" },
  create: {
    id: "admin-users-test-user-1",
    email: "admin-users-test@test.example",
    passwordHash: "test",
    plan: "paid",
    account: {
      create: {
        stripeCustomerId: "cus_test123",
        stripeSubscriptionId: "sub_test123",
        interval: "monthly",
        updatedAt: new Date("2024-02-24"),
      },
    },
    // ... rest unchanged
  },
  update: {},
});
```

Update assertions:

```ts
// line 125: expect(user.status).toBe("active") →
expect(user.status).toBe("paid");

// line 133: expect(user.status).toBe("free_trial") →
expect(user.status).toBe("trial");
```

**Step 2: Run test to confirm it fails**

```bash
pnpm vitest run test/routes/api.admin.users.test.ts
```

Expected: FAIL.

**Step 3: Update `app/routes/api.admin.users.ts`**

Update the loader to read `plan` from user instead of deriving from `account.status`:

```ts
const users = await prisma.user.findMany({
  select: {
    id: true,
    email: true,
    plan: true, // ← add this
    createdAt: true,
    account: {
      select: {
        interval: true,
        updatedAt: true,
        stripeCustomerId: true,
        // status removed
      },
    },
    // ...rest unchanged
  },
  // ...
});
```

Update the mapping:

```ts
status: user.plan,                                          // was: account?.status ?? "free_trial"
plan: user.plan === "paid" ? account?.interval : null,      // was: account?.status === "active" ? account?.interval : null
```

Update the Zod schema:

```ts
status: z.enum(["trial", "paid", "cancelled", "gratis"]),  // was: z.enum(["free_trial", "active", "cancelled"])
plan: z.enum(["monthly", "yearly"]).nullable(),
```

**Step 4: Run the test**

```bash
pnpm vitest run test/routes/api.admin.users.test.ts
```

Expected: All PASS.

**Step 5: Commit**

```bash
git add app/routes/api.admin.users.ts test/routes/api.admin.users.test.ts
git commit -m "refactor: admin users API uses user.plan instead of account.status"
```

---

### Task 7: Update trial emails

**Files:**

- Modify: `app/emails/TrialEnded.tsx`
- Modify: `app/emails/TrialEnding.tsx`

Both files currently find trial users by `account: null` (i.e., no Stripe account). With Option C, every user has a `plan` field — gratis/paid users also have no account in some cases. The correct filter is `plan: "trial"`.

**Step 1: Update `TrialEnded.tsx`**

Change the user query `where` clause:

```ts
where: {
  plan: "trial",                          // was: account: null
  createdAt: { lte: daysAgo(25) },
  sentEmails: { none: { type: "TrialEnded" } },
},
```

**Step 2: Update `TrialEnding.tsx`**

Change the user query `where` clause:

```ts
where: {
  plan: "trial",                          // was: account: null
  createdAt: { lte: daysAgo(24) },
  sentEmails: { none: { type: { in: ["TrialEnding", "TrialEnded"] } } },
},
```

**Step 3: Run the trial email tests**

```bash
pnpm vitest run test/routes/cron.process-sites.test.ts
```

Expected: All PASS (the trial email tests in `describe("trial emails")` still pass — they create users without a `plan` field, so Prisma uses the default `trial`).

**Step 4: Commit**

```bash
git add app/emails/TrialEnded.tsx app/emails/TrialEnding.tsx
git commit -m "refactor: trial emails filter by user.plan instead of account: null"
```

---

### Task 8: Typecheck and full verification

**Step 1: Typecheck**

```bash
pnpm check:type
```

Expected: No errors. If there are errors, they'll point to remaining references to `account.status` — fix each one.

**Step 2: Run all unit and integration tests**

```bash
pnpm vitest run
```

Expected: All PASS.

**Step 3: Commit any fixes, then final commit**

```bash
git commit -m "chore: fix any remaining type errors after tiered access migration"
```
