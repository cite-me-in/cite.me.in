# Query Reliability Patch

**Date:** 2026-03-16
**File:** `app/lib/llm-visibility/queryPlatform.ts`

## Problem

`singleQueryRepetition` calls `queryFn` with `maxRetries: 0` and `timeout: ms("10s")`.
For web-search models (Perplexity, Gemini), 10 seconds is too tight — many queries time
out before the model finishes its crawl. Zero retries means a single transient failure
silently drops a citation record.

Queries within a platform also run sequentially, leaving parallelism on the table.

## Design

Three targeted changes, all in `queryPlatform.ts`:

### 1. Increase timeout to 60 seconds

Change `timeout: ms("10s")` → `timeout: ms("60s")` in `singleQueryRepetition`.

### 2. Add 3 retries

Change `maxRetries: 0` → `maxRetries: 3`. The Vercel AI SDK's `generateText`
handles exponential backoff internally — no custom retry logic required.

### 3. Stagger queries in parallel per platform

Replace the sequential `for` loop with a staggered `Promise.all`. Query `i` starts
after a `i * 1000 ms` delay, so query 0 fires immediately, query 1 at t=1s, query 2
at t=2s, and so on. All queries run concurrently after their delay. Each platform
staggers its own queries independently.

## Scope

- One file changed: `queryPlatform.ts`
- No interface changes; `QueryFn`, client files, and `queryAccount.ts` are untouched
