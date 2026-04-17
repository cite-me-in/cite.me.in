# Google AI Overview Citation Tracking via DataForSEO

**Date:** 2026-03-31
**Status:** Approved

## Problem

cite.me.in tracks LLM citation visibility across ChatGPT, Claude, Gemini, and Perplexity. Google AI Overviews (AIO) are a separate surface — appearing in ~30–40% of informational queries — with their own citation list. We have no visibility into whether tracked sites appear there, or who their AIO competitors are.

## Scope

This implementation covers one concern: **Google AIO citation tracking per query**, using DataForSEO's SERP API. SERP rank tracking (organic position on Google/Bing) is a separate feature.

## Approach

Use DataForSEO's `/v3/serp/google/organic/live/advanced` endpoint. Each response includes a structured `ai_overview` item when an AIO block is present, with a `references` array of cited URLs. We run this per `SiteQuery`, once per day per site, and store results in new dedicated models.

## Schema Changes

### New: `SerpRun`

One row per site/source/date. `source` is `"google-aio"` today; the model accommodates future sources (`"bing-organic"`, etc.).

```prisma
model SerpRun {
  id        String      @id @default(cuid())
  siteId    String      @map("site_id")
  site      Site        @relation(fields: [siteId], references: [id], onDelete: Cascade)
  onDate    String      @map("on_date")
  source    String      @map("source")
  queries   SerpQuery[]
  updatedAt DateTime    @map("updated_at") @updatedAt

  @@unique([siteId, source, onDate])
  @@index([siteId])
  @@map("serp_runs")
}
```

### New: `SerpQuery`

One row per query per run. `aioPresent` distinguishes "site not cited" from "no AIO block appeared." `citations` holds all cited URLs (not just the tracked site's) to enable competitive share-of-voice.

```prisma
model SerpQuery {
  id         String   @id @default(cuid())
  runId      String   @map("run_id")
  run        SerpRun  @relation(fields: [runId], references: [id], onDelete: Cascade)
  query      String   @map("query")
  group      String   @map("group")
  aioPresent Boolean  @map("aio_present")
  citations  String[] @map("citations")
  createdAt  DateTime @map("created_at") @default(now())

  @@index([runId])
  @@map("serp_queries")
}
```

### Modified: `CitationQuery`

Remove unused `position` field.

## New Files

- `app/lib/serp/dataForSeo.server.ts` — HTTP client for DataForSEO SERP API. Posts a keyword, returns `{ aioPresent: boolean, citations: string[] }`.
- `app/lib/serp/queryGoogleAio.server.ts` — loops over `SiteQuery` rows, calls the client per query, upserts a `SerpRun`, creates `SerpQuery` rows. Mirrors the pattern in `queryPlatform.ts`.

## Environment Variables

Two new required vars added to `envVars.server.ts`:

- `DATAFORSEO_LOGIN` — account email
- `DATAFORSEO_PASSWORD` — account password

DataForSEO uses HTTP Basic auth (login + password pair), not a single API key.

## Cron Integration

`cron.process-sites.ts`: add `queryGoogleAio(site)` to the existing `Promise.all([nextCitationRun(site), updateBotInsight(site)])` call.

## What Does Not Change

- Existing LLM citation flow, models, and metrics calculations are untouched.
- No UI changes — new data is stored and available for future dashboard work.
