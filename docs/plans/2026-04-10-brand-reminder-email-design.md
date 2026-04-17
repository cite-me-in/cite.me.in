# Brand Reminder in Emails — Design

## Problem

People who receive cite.me.in emails may not remember what the service does or why they signed up. Every email should act as a marketing touchpoint — reminding the recipient of the value proposition in a warm, personal, and captivating way.

## Approach

Add a personalised brand reminder to all outgoing emails. The reminder uses the recipient's own data (domain + citation count) to make the message feel specific, not boilerplate.

Two delivery mechanisms depending on email type:

- **Data/visual emails** (WeeklyDigest, SiteSetupComplete): a styled card block at the bottom of the email body, above the footer.
- **Text emails** (TrialEnding, TrialEnded): the reminder is woven into existing prose paragraphs, not a separate block.

## New Code

### `app/components/email/BrandReminder.tsx`

Exports two things:

**`BrandReminderCard` (React component)**
Props: `{ domain: string; citations: number }`
Renders a styled `Card` with copy:

> "cite.me.in is your window into how AI talks about your brand. Every day it asks ChatGPT, Claude, Gemini, and Perplexity the questions your customers ask — and records every time **{domain}** shows up. So far: **{N} citations** and counting."

**`brandReminderText()` (plain function)**
Signature: `({ domain, citations }: { domain: string; citations: number }): string`
Returns:

> "A quick reminder of why you're here: cite.me.in tracks every time ChatGPT, Claude, Gemini, or Perplexity cites {domain} in a real answer. You've collected {N} citation(s) so far. That's the number you're here to grow."

## Per-Email Changes

| Email               | Change                                                   | Data                                                |
| ------------------- | -------------------------------------------------------- | --------------------------------------------------- |
| `WeeklyDigest`      | Add `<BrandReminderCard>` after `<VisitorKeyMetrics>`    | `domain` (add to props), `citations.domain.current` |
| `SiteSetupComplete` | Add `<BrandReminderCard>` after `<SetupTopCompetitors>`  | `domain`, `metrics.totalCitations`                  |
| `TrialEnding`       | Embed `brandReminderText()` in second `<Text>` paragraph | `domain`, `citationCount`                           |
| `TrialEnded`        | Embed `brandReminderText()` in first `<Text>` paragraph  | `domain`, `citationCount`                           |

### Copy in context

**TrialEnding** — second paragraph:

> "A quick reminder of why you're here: cite.me.in tracks every time ChatGPT, Claude, Gemini, or Perplexity cites {domain} in a real answer. So far you've collected {N} citation(s) — and daily tracking continues with Pro for ${price}/month."

**TrialEnded** — first paragraph:

> "A quick reminder of why you're here: cite.me.in tracks every time ChatGPT, Claude, Gemini, or Perplexity cites {domain} in a real answer. Over 25 days you collected {N} citation(s) across {Q} quer(y/ies) — your free trial has now ended."

## Schema Change

`WeeklyDigestEmailProps` does not currently include `domain`. Add it to the type and thread it through from `sendSiteDigestEmails()`, where the site is already queried.

## Files Touched

- `app/components/email/BrandReminder.tsx` — new file
- `app/emails/WeeklyDigest.tsx` — add `domain` to props, add `<BrandReminderCard>`
- `app/emails/SiteSetupComplete.tsx` — add `<BrandReminderCard>`
- `app/emails/TrialEnding.tsx` — rewrite second paragraph using `brandReminderText()`
- `app/emails/TrialEnded.tsx` — rewrite first paragraph using `brandReminderText()`
