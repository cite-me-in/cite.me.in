# Email Deduplication Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Replace fragile date-range window deduplication for trial emails with a generic `SentEmail` table that records every automated email sent to a user.

**Architecture:** A new `sent_emails` table stores `(userId, type, sentAt)`. Eligibility queries filter out users who already have a matching record using Prisma's `sentEmails: { none: { type: "..." } }` filter. After each successful send, a record is inserted. WeeklyDigest is unchanged (stays on `site.digestSentAt`).

**Tech Stack:** Prisma, PostgreSQL, TypeScript, Temporal (via `@js-temporal/polyfill`), Vitest

---

### Task 1: Add SentEmail model to Prisma schema (Task #6)

**Files:**

- Modify: `prisma/schema.prisma` — User model (~line 254), end of file

**Step 1: Add SentEmail model**

Append before the final `@@map("users")` line in the User model:

```prisma
  sentEmails             SentEmail[]
```

Then append this model at the end of `prisma/schema.prisma`:

```prisma
model SentEmail {
  id     String   @id @default(cuid())
  sentAt DateTime @map("sent_at") @default(now())
  type   String   @map("type")
  user   User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId String   @map("user_id")

  @@index([userId, type])
  @@map("sent_emails")
}
```

**Step 2: Apply to dev database**

```bash
pnpm test:db:push
```

Expected: `Your database is now in sync with your Prisma schema.`

**Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add SentEmail model to track automated emails per user"
```

---

### Task 2: Add daysAgo utility (Task #7)

**Files:**

- Modify: `app/lib/formatDate.ts`

**Step 1: Add Temporal import and daysAgo function**

At the top of `app/lib/formatDate.ts`, add:

```ts
import { Temporal } from "@js-temporal/polyfill";
```

At the end of the file, add:

```ts
export function daysAgo(days: number): Date {
  return new Date(Temporal.Now.instant().subtract({ hours: days * 24 }).epochMilliseconds);
}
```

**Step 2: Commit**

```bash
git add app/lib/formatDate.ts
git commit -m "feat: add daysAgo date utility"
```

---

### Task 3: Write failing test for TrialEnded deduplication (Task #8)

**Files:**

- Modify: `test/routes/cron.process-sites.test.ts`

**Step 1: Add a new describe block for trial emails**

Add after the closing brace of the `"site processing"` describe block:

```ts
describe("trial emails", () => {
  beforeEach(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: "trial-email" } } });
  });

  it("should send TrialEnded email once and not again", async () => {
    const user = await prisma.user.create({
      data: {
        id: "user-trial-email-1",
        email: "trial-email-ended@test.com",
        passwordHash: "test",
        createdAt: new Date(Temporal.Now.instant().subtract({ hours: 24 * 26 }).epochMilliseconds),
        ownedSites: {
          create: {
            id: "site-trial-email-1",
            apiKey: "test-api-key-trial-email-1",
            content: "Test content",
            domain: "trial-ended.example.com",
            summary: "Test summary",
          },
        },
      },
    });

    await makeRequest("test-cron-secret");

    const after1 = await prisma.sentEmail.findMany({
      where: { userId: user.id, type: "TrialEnded" },
    });
    expect(after1.length).toBe(1);

    await makeRequest("test-cron-secret");

    const after2 = await prisma.sentEmail.findMany({
      where: { userId: user.id, type: "TrialEnded" },
    });
    expect(after2.length).toBe(1);
  });
});
```

**Step 2: Run test — expect FAIL**

```bash
pnpm vitest run test/routes/cron.process-sites.test.ts
```

Expected: FAIL — `expect(after1.length).toBe(1)` fails with `received 0` (no SentEmail record created yet).

**Step 3: Commit**

```bash
git add test/routes/cron.process-sites.test.ts
git commit -m "test: add failing test for TrialEnded deduplication"
```

---

### Task 4: Refactor TrialEnded to use SentEmail (Task #9)

**Files:**

- Modify: `app/emails/TrialEnded.tsx`

**Step 1: Replace the implementation**

Replace the entire `sendTrialEndedEmails` function with:

```ts
import { daysAgo } from "~/lib/formatDate";

export default async function sendTrialEndedEmails() {
  const users = await prisma.user.findMany({
    where: {
      createdAt: { lte: daysAgo(25) },
      account: null,
      sentEmails: { none: { type: "TrialEnded" } },
    },
    include: {
      ownedSites: {
        take: 1,
        select: {
          id: true,
          domain: true,
          _count: { select: { citationRuns: true } },
        },
      },
    },
  });

  for (const user of users) {
    const site = user.ownedSites[0];
    if (!site || user.unsubscribed) continue;
    const citationCount = await countSiteCitations(site.id);
    const result = await sendTrialEndedEmail({
      user,
      citationCount,
      domain: site.domain,
      queryCount: site._count.citationRuns,
    });
    if (result) await prisma.sentEmail.create({ data: { userId: user.id, type: "TrialEnded" } });
  }
}
```

Remove the `trialDays` parameter — it's no longer needed. Also remove the `Temporal` import if it's no longer used elsewhere in the file.

**Step 2: Run test — expect PASS**

```bash
pnpm vitest run test/routes/cron.process-sites.test.ts
```

Expected: PASS.

**Step 3: Commit**

```bash
git add app/emails/TrialEnded.tsx
git commit -m "feat: refactor TrialEnded to use SentEmail deduplication"
```

---

### Task 5: Write failing test + refactor TrialEnding (Task #10)

**Files:**

- Modify: `test/routes/cron.process-sites.test.ts`
- Modify: `app/emails/TrialEnding.tsx`

**Step 1: Add two tests to the `"trial emails"` describe block**

```ts
it("should not send TrialEnding if TrialEnded already sent", async () => {
  const user = await prisma.user.create({
    data: {
      id: "user-trial-email-2",
      email: "trial-email-ending-skip@test.com",
      passwordHash: "test",
      createdAt: new Date(Temporal.Now.instant().subtract({ hours: 24 * 25 }).epochMilliseconds),
      sentEmails: { create: { type: "TrialEnded" } },
      ownedSites: {
        create: {
          id: "site-trial-email-2",
          apiKey: "test-api-key-trial-email-2",
          content: "Test content",
          domain: "trial-ending-skip.example.com",
          summary: "Test summary",
        },
      },
    },
  });

  await makeRequest("test-cron-secret");

  const records = await prisma.sentEmail.findMany({
    where: { userId: user.id, type: "TrialEnding" },
  });
  expect(records.length).toBe(0);
});

it("should send TrialEnding once and not again", async () => {
  const user = await prisma.user.create({
    data: {
      id: "user-trial-email-3",
      email: "trial-email-ending@test.com",
      passwordHash: "test",
      createdAt: new Date(Temporal.Now.instant().subtract({ hours: 24 * 24 }).epochMilliseconds),
      ownedSites: {
        create: {
          id: "site-trial-email-3",
          apiKey: "test-api-key-trial-email-3",
          content: "Test content",
          domain: "trial-ending.example.com",
          summary: "Test summary",
        },
      },
    },
  });

  await makeRequest("test-cron-secret");

  const after1 = await prisma.sentEmail.findMany({
    where: { userId: user.id, type: "TrialEnding" },
  });
  expect(after1.length).toBe(1);

  await makeRequest("test-cron-secret");

  const after2 = await prisma.sentEmail.findMany({
    where: { userId: user.id, type: "TrialEnding" },
  });
  expect(after2.length).toBe(1);
});
```

**Step 2: Run tests — expect FAIL**

```bash
pnpm vitest run test/routes/cron.process-sites.test.ts
```

Expected: FAIL — TrialEnding records are being created (or not) incorrectly.

**Step 3: Refactor TrialEnding**

Replace `sendTrialEndingEmails` in `app/emails/TrialEnding.tsx`:

```ts
import { daysAgo } from "~/lib/formatDate";

export default async function sendTrialEndingEmails() {
  const users = await prisma.user.findMany({
    where: {
      createdAt: { lte: daysAgo(24) },
      account: null,
      sentEmails: { none: { type: { in: ["TrialEnding", "TrialEnded"] } } },
    },
    include: {
      ownedSites: {
        take: 1,
        select: {
          id: true,
          domain: true,
          _count: { select: { citationRuns: true } },
        },
      },
    },
  });

  for (const user of users) {
    const site = user.ownedSites[0];
    if (!site || user.unsubscribed) continue;
    const citationCount = await countSiteCitations(site.id);
    const result = await sendTrialEndingEmail({
      user,
      citationCount,
      domain: site.domain,
    });
    if (result) await prisma.sentEmail.create({ data: { userId: user.id, type: "TrialEnding" } });
  }
}
```

Remove the `trialDays` parameter and the `Temporal` import if unused.

**Step 4: Run tests — expect PASS**

```bash
pnpm vitest run test/routes/cron.process-sites.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add test/routes/cron.process-sites.test.ts app/emails/TrialEnding.tsx
git commit -m "feat: refactor TrialEnding to use SentEmail deduplication"
```

---

### Task 6: Fix cron execution order (Task #11)

**Files:**

- Modify: `app/routes/cron.process-sites.ts`

**Step 1: Replace Promise.all with sequential execution**

Find:

```ts
await Promise.all([sendTrialEndingEmails(trialDays), sendTrialEndedEmails(trialDays)]);
```

Replace with:

```ts
await sendTrialEndedEmails();
await sendTrialEndingEmails();
```

Also remove the `trialDays` constant if it's no longer used elsewhere in the file (it's still used in `prepareSites(trialDays)` — check before removing).

**Step 2: Run full test suite for affected files**

```bash
pnpm vitest run test/routes/cron.process-sites.test.ts
```

Expected: PASS.

**Step 3: Commit**

```bash
git add app/routes/cron.process-sites.ts
git commit -m "fix: run TrialEnded before TrialEnding to prevent same-run race"
```

---

### Task 7: Run migration backfill (Task #12)

**Files:**

- Create: `scripts/backfill-sent-emails.ts` (delete after running)

**Step 1: Write the script**

```ts
import prisma from "~/lib/prisma.server";
import { daysAgo } from "~/lib/formatDate";

const oldEnded = await prisma.user.findMany({
  where: { createdAt: { lte: daysAgo(25) }, account: null },
  select: { id: true },
});

const oldEnding = await prisma.user.findMany({
  where: { createdAt: { lte: daysAgo(24) }, account: null },
  select: { id: true },
});

await prisma.sentEmail.createMany({
  data: oldEnded.map((u) => ({ userId: u.id, type: "TrialEnded" })),
});

await prisma.sentEmail.createMany({
  data: oldEnding.map((u) => ({ userId: u.id, type: "TrialEnding" })),
});

console.log(`Backfilled: ${oldEnded.length} TrialEnded, ${oldEnding.length} TrialEnding`);
```

**Step 2: Run against dev database**

```bash
infisical --env dev run -- tsx scripts/backfill-sent-emails.ts
```

Expected: `Backfilled: N TrialEnded, M TrialEnding`

**Step 3: Run against production database**

```bash
infisical --env prod run -- tsx scripts/backfill-sent-emails.ts
```

**Step 4: Delete the script and commit**

```bash
rm scripts/backfill-sent-emails.ts
git add -A
git commit -m "chore: backfill SentEmail records for existing users"
```

---

### Final verification

```bash
pnpm check:type
pnpm vitest run test/routes/cron.process-sites.test.ts
```

Both should pass with no errors.
