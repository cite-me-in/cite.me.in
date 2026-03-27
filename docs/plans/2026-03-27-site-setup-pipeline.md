# Site Setup Pipeline — Design

## Overview

When a user adds a new site, the entire pipeline (crawl → summarize → generate queries → run against all 4 LLM platforms) runs fully automatically. The user watches a live scrolling log on a dedicated setup page — one line per operation, like LLM thinking output. When complete, they receive a confirmation email and are redirected to citations.

## Flow

### 1. Submit URL (synchronous)

POST `/sites` does only:
- Parse and validate the URL format
- Make a single HEAD request to confirm the site is reachable
- Create a minimal `Site` record in DB
- Fire the pipeline worker as a background fetch (fire-and-forget) to `POST /site/{domain}/setup/run`, passing `userId`
- Redirect immediately to `/site/{domain}/setup`

### 2. Setup Page

`/site/{domain}/setup` — a dedicated route that:
- Requires auth (`requireUser`)
- Polls `GET /site/{domain}/setup/status?offset=N` every 2 seconds
- Renders each log line as it arrives (append-only, scrolling)
- When `done: true`, waits briefly then redirects to `/site/{domain}/citations`

### 3. Pipeline Worker

`POST /site/{domain}/setup/run` — runs in its own Vercel function invocation with its own timeout budget. Executes the full pipeline sequentially, writing to Redis after each operation:

**Steps and example log lines:**
```
Checking site access...
Crawling site...
  Found 8 pages
  Reading /about
  Reading /pricing
  ...
Summarizing content (3,240 words)...
  [one-line summary of what the site does]
Generating queries...
  Discovery: "best tools for X"
  Discovery: "how to find Y online"
  Active search: "X vs competitors"
  ... (9 queries total across 3 groups)
Saving queries...
Querying ChatGPT (1/9)...
Querying ChatGPT (2/9)...
  ...
Querying Claude (1/9)...
  ...
Querying Perplexity (1/9)...
  ...
Querying Gemini (1/9)...
  ...
All queries complete — sending confirmation email
Done
```

Platforms are queried sequentially (not in parallel) during setup so progress is granular and readable.

### 4. Confirmation Email

Sent when the pipeline completes. Simple transactional email: site has been set up, here's a link to your citations dashboard.

## Redis Schema

Keys are scoped to both site and user so no other user can read another's progress:

- `setup:{siteId}:{userId}:log` — Redis List; worker appends one entry per log line (`RPUSH`)
- `setup:{siteId}:{userId}:status` — String; `running` | `complete` | `error`

TTL: set to 24 hours on both keys after pipeline completes.

## Polling Endpoint

`GET /site/{domain}/setup/status?offset=N`

- Requires auth; verifies `userId` matches before reading Redis
- Reads `LRANGE setup:{siteId}:{userId}:log N -1`
- Returns: `{ lines: string[], done: boolean, nextOffset: number }`

## Removed

- `/site/{domain}/suggestions` route — no longer needed; query review step is eliminated
- The `SiteQuerySuggestion` table entries are still created internally but the review UI is bypassed

## Routes Added / Changed

| Route | Change |
|---|---|
| `POST /sites` | Slim down to validate + fire-and-forget only |
| `GET /site/{domain}/setup` | New — live log page |
| `POST /site/{domain}/setup/run` | New — pipeline worker endpoint |
| `GET /site/{domain}/setup/status` | New — polling endpoint |
| `GET /site/{domain}/suggestions` | Remove or redirect to citations |
