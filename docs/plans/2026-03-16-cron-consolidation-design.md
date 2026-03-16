# Cron Consolidation Design

**Date:** 2026-03-16

## Problem

Three separate cron jobs run on different schedules with no coordination, no site eligibility filtering, and no concept of paid vs. free-trial accounts. The goal is a single cron that runs every four hours, processes only eligible sites, and executes all three steps (citation run → bot insights → digest email) per site.

## Account Model

Add an `Account` model to the schema representing a Stripe subscription. One account per user (1:1).

```prisma
model Account {
  id                   String   @id @default(cuid())
  userId               String   @unique @map("user_id")
  stripeCustomerId     String   @map("stripe_customer_id")
  stripeSubscriptionId String   @map("stripe_subscription_id")
  status               String   @map("status")
  createdAt            DateTime @map("created_at") @default(now())
  updatedAt            DateTime @map("updated_at") @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("accounts")
}
```

`User` gains an `account Account?` relation field. A user is "paid" when `account?.status === 'active'`.

## Site Filtering

The cron fetches all sites with their owner's `account` and the most recent `CitationQueryRun`. A site qualifies when both conditions hold:

1. **Not recently processed** — no citation run in the last 7 days (or never run)
2. **Eligible tier** — owner has `account.status === 'active'` (paid), or site is less than 24 days old (free trial)

## Consolidated Cron: `cron.process-sites.ts`

**Route:** `/cron/process-sites`
**Schedule:** `0 */4 * * *` (every four hours)
**Auth:** `Authorization: Bearer <CRON_SECRET>` (same as existing crons)

For each qualifying site, steps run sequentially:

1. **Citation run** — fetch the site's `SiteQuery` rows, call `queryAccount({ site, queries })`
2. **Bot insights** — fetch last 7 days of `BotVisit` rows, call `generateBotInsight`, upsert `BotInsight`
3. **Digest email** — compute weekly metrics, generate chart, send `WeeklyDigestEmail` to opted-in users

A per-step try/catch logs failures and continues to the next step. A site-level try/catch ensures one site's failure does not block others.

## Cleanup

- Delete `cron.citation-runs.ts`, `cron.bot-insights.ts`, `cron.weekly-digest.ts`
- Replace the three entries in `.vercel/vercel.json` with the single new `/cron/process-sites` entry
- Add `HEARTBEAT_CRON_PROCESS_SITES` to `envVars.ts`; remove `HEARTBEAT_CRON_CITATIONS`, `HEARTBEAT_CRON_BOT_INSIGHTS`, `HEARTBEAT_CRON_WEEKLY_DIGEST`
