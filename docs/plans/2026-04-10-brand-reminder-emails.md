# Brand Reminder Emails — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Add a personalised brand reminder to every outgoing email so recipients always know what cite.me.in does and why they signed up.

**Architecture:** A shared `BrandReminder.tsx` exports two things: a `BrandReminderCard` React component (card block for data emails) and a `brandReminderText()` function (string for weaving into prose). Data emails (WeeklyDigest, SiteSetupComplete) get the card at the bottom. Text emails (TrialEnding, TrialEnded) get the text woven into existing paragraphs.

**Tech Stack:** React Email, Tailwind CSS (via `@react-email/components`), existing `Card` email component at `app/components/email/Card.tsx`.

---

### Task 1: Create `BrandReminder.tsx`

**Files:**

- Create: `app/components/email/BrandReminder.tsx`

No test needed — the component is covered by the visual regression tests in Tasks 3 and 4.

**Step 1: Create the file**

```tsx
import { Text } from "@react-email/components";
import Card from "~/components/email/Card";

export function BrandReminderCard({ domain, citations }: { domain: string; citations: number }) {
  const n = citations.toLocaleString();
  const noun = citations === 1 ? "citation" : "citations";
  return (
    <Card withBorder>
      <Text className="text-base text-text leading-relaxed">
        cite.me.in is your window into how AI talks about your brand. Every day it asks ChatGPT,
        Claude, Gemini, and Perplexity the questions your customers ask — and records every time{" "}
        <strong>{domain}</strong> shows up. So far:{" "}
        <strong>
          {n} {noun}
        </strong>{" "}
        and counting.
      </Text>
    </Card>
  );
}

export function brandReminderText({
  domain,
  citations,
}: {
  domain: string;
  citations: number;
}): string {
  const n = citations.toLocaleString();
  const noun = citations === 1 ? "citation" : "citations";
  return (
    `A quick reminder of why you're here: cite.me.in tracks every time ` +
    `ChatGPT, Claude, Gemini, or Perplexity cites ${domain} in a real answer. ` +
    `You've collected ${n} ${noun} so far. That's the number you're here to grow.`
  );
}
```

**Step 2: Typecheck**

```bash
pnpm check:type
```

Expected: no errors.

**Step 3: Commit**

```bash
git add app/components/email/BrandReminder.tsx
git commit -m "feat: add BrandReminderCard component and brandReminderText helper"
```

---

### Task 2: Thread `domain` through WeeklyDigest

`WeeklyDigestEmailProps` does not currently include `domain`, but it's needed by `BrandReminderCard`. The `domain` value is already computed in `weeklyDigest.server.ts` at line 46 (`const { domain } = metrics.site`) but not returned.

**Files:**

- Modify: `app/emails/WeeklyDigest.tsx`
- Modify: `app/lib/weeklyDigest.server.ts`
- Modify: `test/routes/email.weekly-digest.test.ts`

**Step 1: Add `domain` to `WeeklyDigestEmailProps`**

In `app/emails/WeeklyDigest.tsx`, add `domain: string` to the type and destructure it in `WeeklyDigestEmail`:

```ts
// In WeeklyDigestEmailProps type — add:
domain: string;
```

```tsx
// In WeeklyDigestEmail function — add domain to destructuring:
export function WeeklyDigestEmail({
  domain,
  queryCoverageRate,
  byPlatform,
  // ... rest unchanged
}: WeeklyDigestEmailProps) {
```

**Step 2: Return `domain` from `loadWeeklyDigestMetrics`**

In `app/lib/weeklyDigest.server.ts`, the return object at line 169 is missing `domain`. Add it:

```ts
return {
  domain,      // ← add this line (domain is already computed at line 46)
  queryCoverageRate: { ... },
  // ... rest unchanged
};
```

**Step 3: Add `domain` to the test fixture**

In `test/routes/email.weekly-digest.test.ts`, add `domain: "rentail.space"` to the `sendSiteDigestEmails(...)` call (alongside `siteId`, `subject`, etc.):

```ts
await sendSiteDigestEmails({
  domain: "rentail.space", // ← add this
  // ... rest unchanged
});
```

**Step 4: Typecheck**

```bash
pnpm check:type
```

Expected: no errors.

**Step 5: Commit**

```bash
git add app/emails/WeeklyDigest.tsx app/lib/weeklyDigest.server.ts test/routes/email.weekly-digest.test.ts
git commit -m "feat: add domain to WeeklyDigestEmailProps and thread through server"
```

---

### Task 3: Add `BrandReminderCard` to `WeeklyDigest`

**Files:**

- Modify: `app/emails/WeeklyDigest.tsx`

**Step 1: Import and render the card**

Add the import at the top of `app/emails/WeeklyDigest.tsx`:

```ts
import { BrandReminderCard } from "~/components/email/BrandReminder";
```

In `WeeklyDigestEmail`, add `<BrandReminderCard>` after `<VisitorKeyMetrics>`:

```tsx
<VisitorKeyMetrics
  pageViews={visits.pageViews}
  uniqueVisitors={visits.uniqueVisitors}
  aiReferredVisitors={visits.aiReferredVisitors}
  botVisits={visits.botVisits}
/>
<BrandReminderCard
  domain={domain}
  citations={citations.domain.current}
/>
```

**Step 2: Delete the stale visual baseline**

The visual snapshot will change. Delete the old baselines so they regenerate:

```bash
rm __screenshots__/email/weekly-digest.png __screenshots__/email/weekly-digest.html
```

**Step 3: Run the weekly digest email test**

```bash
pnpm vitest run test/routes/email.weekly-digest.test.ts
```

Expected: all tests pass; new baselines created at `__screenshots__/email/weekly-digest.{png,html}`.

**Step 4: Commit**

```bash
git add app/emails/WeeklyDigest.tsx __screenshots__/email/weekly-digest.png __screenshots__/email/weekly-digest.html
git commit -m "feat: add BrandReminderCard to WeeklyDigest email"
```

---

### Task 4: Add `BrandReminderCard` to `SiteSetupComplete`

**Files:**

- Modify: `app/emails/SiteSetupComplete.tsx`

**Step 1: Import and render the card**

Add the import:

```ts
import { BrandReminderCard } from "~/components/email/BrandReminder";
```

In `SiteSetupComplete`, add `<BrandReminderCard>` after `<SetupTopCompetitors>`:

```tsx
<SetupTopCompetitors competitors={metrics.competitors} />
<BrandReminderCard domain={domain} citations={metrics.totalCitations} />
```

**Step 2: Delete the stale visual baseline**

```bash
rm __screenshots__/email/site-setup.png __screenshots__/email/site-setup.html
```

**Step 3: Run the site setup email test**

```bash
pnpm vitest run test/routes/email.site-setup.test.ts
```

Expected: all tests pass; new baselines created.

**Step 4: Commit**

```bash
git add app/emails/SiteSetupComplete.tsx __screenshots__/email/site-setup.png __screenshots__/email/site-setup.html
git commit -m "feat: add BrandReminderCard to SiteSetupComplete email"
```

---

### Task 5: Update `TrialEnding`

**Files:**

- Modify: `app/emails/TrialEnding.tsx`

**Step 1: Import `brandReminderText`**

```ts
import { brandReminderText } from "~/components/email/BrandReminder";
```

**Step 2: Rewrite the body paragraphs**

The current email has three `<Text>` blocks plus a button. Replace paragraphs 2 and 3 with a single paragraph that fuses the brand reminder with the upgrade CTA:

Before:

```tsx
<Text>
  So far you've collected {citationCount} citation
  {citationCount !== 1 ? "s" : ""} across ChatGPT, Claude, Gemini, and
  Copilot. No pressure — just a heads up.
</Text>
<Text>
  If you'd like to keep your history and continue daily runs, upgrade to
  Pro for ${prices.monthlyAmount}/month.
</Text>
```

After:

```tsx
<Text>
  {brandReminderText({ domain, citations: citationCount })} If you'd like to keep your history and
  continue daily runs, upgrade to Pro for ${prices.monthlyAmount}/month.
</Text>
```

**Step 3: Typecheck**

```bash
pnpm check:type
```

**Step 4: Commit**

```bash
git add app/emails/TrialEnding.tsx
git commit -m "feat: add brand reminder to TrialEnding email"
```

---

### Task 6: Update `TrialEnded`

**Files:**

- Modify: `app/emails/TrialEnded.tsx`

**Step 1: Import `brandReminderText`**

```ts
import { brandReminderText } from "~/components/email/BrandReminder";
```

**Step 2: Rewrite the body paragraphs**

The current email has two `<Text>` blocks plus a button. Merge them into one paragraph that fuses the brand reminder with the upgrade CTA:

Before:

```tsx
<Text>
  Over the last 25 days, you tracked {citationCount} citation
  {citationCount !== 1 ? "s" : ""} for {domain} across {queryCount}{" "}
  {queryCount !== 1 ? "queries" : "query"}.
</Text>
<Text>
  Your free trial has ended and daily runs have paused. Upgrade to Pro
  to keep your history and resume monitoring — ${prices.monthlyAmount}
  /month or ${prices.annualAmount}/year.
</Text>
```

After:

```tsx
<Text>
  {brandReminderText({ domain, citations: citationCount })} Your free trial has ended and daily runs
  have paused. Upgrade to Pro to keep your history and resume monitoring — ${prices.monthlyAmount}
  /month or ${prices.annualAmount}/year.
</Text>
```

**Step 3: Typecheck**

```bash
pnpm check:type
```

**Step 4: Commit**

```bash
git add app/emails/TrialEnded.tsx
git commit -m "feat: add brand reminder to TrialEnded email"
```

---

### Task 7: Full verification

**Step 1: Typecheck and lint**

```bash
pnpm check:type && pnpm check:lint
```

Expected: no errors.

**Step 2: Run full test suite**

```bash
pnpm vitest run
```

Expected: all tests pass.

**Step 3: Run Playwright email tests**

```bash
playwright test test/routes/email.weekly-digest.test.ts test/routes/email.site-setup.test.ts
```

Expected: visual baselines match (they were regenerated in Tasks 3 and 4).
