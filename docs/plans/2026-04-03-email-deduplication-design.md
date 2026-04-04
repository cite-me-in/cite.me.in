# Email Deduplication Design

**Date:** 2026-04-03

## Problem

The current trial email system uses narrow date-range queries to deduplicate sends (e.g., find users whose `createdAt` falls within a 24-hour window). This is fragile: if the cron runs twice in a day, users get duplicate emails; if it skips a day, users miss the window permanently. There is no record of which emails were actually sent.

## Decision

Add a generic `SentEmail` table that records every automated email sent to a user. Eligibility queries filter out users who already have a matching record. This replaces the date-range window approach for trial emails.

WeeklyDigest is **unchanged** — it remains tracked per-site via `site.digestSentAt`, since one send covers all site members.

## Schema

New model in `prisma/schema.prisma`:

```prisma
model SentEmail {
  id     String   @id @default(cuid())
  type   String   @map("type")
  sentAt DateTime @map("sent_at") @default(now())
  user   User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId String   @map("user_id")

  @@index([userId, type])
  @@map("sent_emails")
}
```

Add `sentEmails SentEmail[]` to the `User` model.

No unique constraint — the schema supports future recurring emails. Deduplication is enforced in queries.

## Shared utility

Add `daysAgo(days: number): Date` to `app/lib/formatDate.ts`:

```ts
export function daysAgo(days: number): Date {
  return new Date(
    Temporal.Now.instant().subtract({ hours: days * 24 }).epochMilliseconds
  );
}
```

Replaces the inline `Temporal.Now.instant().subtract(...)` pattern in trial email files.

## Eligibility queries

**TrialEnded** — users 25+ days old, no account, never received TrialEnded:

```ts
where: {
  createdAt: { lte: daysAgo(25) },
  account: null,
  sentEmails: { none: { type: "TrialEnded" } },
}
```

**TrialEnding** — users 24+ days old, no account, never received TrialEnding or TrialEnded:

```ts
where: {
  createdAt: { lte: daysAgo(24) },
  account: null,
  sentEmails: { none: { type: { in: ["TrialEnding", "TrialEnded"] } } },
}
```

After each successful send, insert a `SentEmail` record:

```ts
await prisma.sentEmail.create({ data: { userId: user.id, type: "TrialEnded" } })
```

## Execution order

`sendTrialEndedEmails` must run **before** `sendTrialEndingEmails` — sequentially, not `Promise.all`. This ensures that if a user qualifies for both (e.g., cron skipped a day and the user is 26 days old), the TrialEnded record is written before TrialEnding's query runs, so TrialEnding skips them correctly.

## Migration

At deploy time, backfill `SentEmail` records to prevent retroactive sends to users already past the eligibility windows:

- Insert `{ type: "TrialEnded" }` for all users where `createdAt <= daysAgo(25) AND account = null`
- Insert `{ type: "TrialEnding" }` for all users where `createdAt <= daysAgo(24) AND account = null`

Users currently in the 24–25 day window proceed normally through the new system on the next cron run.

## Adding new email types

To guard a future email (e.g., `WelcomeDay3`):

1. Add the send logic with `sentEmails: { none: { type: "WelcomeDay3" } }` in the eligibility query.
2. Insert `{ userId, type: "WelcomeDay3" }` after sending.
3. No schema changes required.
