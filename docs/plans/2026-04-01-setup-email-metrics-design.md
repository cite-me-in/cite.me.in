# Design: Enhanced Setup Complete Email with First-Run Metrics

**Date:** 2026-04-01
**Status:** Approved

## Problem

The `SiteSetupComplete` email currently contains only a confirmation message and a CTA button. By the time this email is sent, the setup pipeline has already run queries against all four AI platforms and produced citation data. That data goes unused in the email, leaving users with no immediate signal about their LLM visibility.

## Goal

Show users a "first impressions" snapshot in the setup complete email: what was found in the initial run across platforms, which queries triggered citations, initial sentiment, and top competitors. No week-over-week comparison — this is one data point, framed as "here's what we found."

## Data Layer

Add `loadSetupMetrics(domain: string)` — a new function in `app/lib/setupMetrics.server.ts`. It queries the most recent `SerpRun` records for the domain and returns:

```ts
type SetupMetrics = {
  totalCitations: number;
  byPlatform: Record<
    Platform,
    { citations: number; sentiment: string | null; sentimentSummary: string | null }
  >;
  topQueries: Array<{ query: string; citations: number }>; // top 5
  competitors: Array<{ domain: string; citations: number }>; // top 5
};
```

`sendSiteSetupEmail()` calls `loadSetupMetrics()` and passes the result as props to the email template.

## Email Template Sections

`SiteSetupComplete.tsx` gets four new sections below the existing header/CTA, styled to match the weekly digest aesthetic but without any delta indicators or trend charts:

1. **Citations by platform** — four platform cards showing citation count for each (ChatGPT, Claude, Perplexity, Gemini)
2. **Top queries** — table: query text + citation count, top 5
3. **Sentiment** — one row per platform: platform name, sentiment label, brief summary
4. **Top competitors** — table: competitor domain + citation count, top 5

Sections with no data (e.g., zero citations across all platforms) render a neutral "nothing found yet" state rather than being hidden.

## Testing

Update `test/routes/email.site-setup.test.ts`:

- Pass static fixture data to `sendSiteSetupEmail()` covering all four sections
- Fixture includes edge cases: a platform with zero citations, a negative sentiment entry, a full competitor table
- Viewport increases from 1024×768 to 1024×2048 to capture full email height
- Delete existing baselines (`__screenshots__/email/site-setup.png` and `site-setup.html`) so they regenerate on first run

## Out of Scope

- Trend charts (one data point is not a trend)
- Week-over-week deltas
- Sharing the data-fetching layer with `weeklyDigest.server.ts` (can be refactored later if needed)
