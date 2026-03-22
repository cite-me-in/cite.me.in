# Scraper Design: Smart Site Content Fetcher

**Date:** 2026-03-21
**Status:** Approved

## Overview

Enhance `fetchSiteContent` from `sites.server.ts` into a proper `app/lib/scrape/` module with smarter content discovery, multi-format extraction, and three hard limits (words, pages, time).

## Module Structure

```
app/lib/scrape/
  index.ts        — public API: fetchSiteContent(), re-exports types
  crawl.ts        — orchestrator: bounded-concurrency queue, limits, page loop
  discover.ts     — URL discovery: llms.txt, robots.txt, sitemap, nav, RSS
  extract.ts      — content extraction: Markdown detection, JSON-LD, HTML→text
test/lib/scrape/
  crawl.test.ts
  discover.test.ts
  extract.test.ts
  fixtures/
    llms-txt/         — site with llms.txt
    sitemap-txt/      — site with sitemap.txt
    sitemap-xml/      — site with sitemap.xml
    json-ld/          — HTML with JSON-LD articleBody
    nav-only/         — fallback nav links
    robots-disallow/  — robots.txt with Disallow rules
    rss-feed/         — site with RSS/Atom feed link
    canonical-skip/   — pages with rel=canonical pointing elsewhere
```

`sites.server.ts` keeps `fetchSiteContent` but imports it from `~/lib/scrape`.

## Public API

```ts
fetchSiteContent({
  domain: string,
  maxWords?: number,   // default 5_000
  maxPages?: number,   // default 20
  maxSeconds?: number, // default 10
}): Promise<string>
```

## Discovery Pipeline (`discover.ts`)

Runs in parallel before the crawl loop begins. Returns a **priority-ordered URL list**. All discovery requests share the crawl AbortSignal.

1. **`/llms.txt`** — if HTTP 200, parse all `https?://` URLs from the body. These are inserted **first** in the queue (highest priority).
2. **`/robots.txt`** — parse `Disallow:` rules into a Set; used to filter all subsequent URLs.
3. **Homepage sitemap hint** — inspect homepage HTML for `<link rel="sitemap">` or text references to `sitemap.txt`/`sitemap.xml`.
4. **Sitemap** — try `/sitemap.txt` first; if not found, try `/sitemap.xml`. **Never use both.** Parse URLs, filter against robots rules.
5. **RSS/Atom feed** — check `<link rel="alternate" type="application/rss+xml|atom+xml">` in homepage `<head>`; extract item links as additional candidate URLs.
6. **Nav fallback** — if no sitemap and no RSS: extract `<nav>` anchor `href`s from homepage (current behavior).

URL normalization applied everywhere: strip trailing slash, query params, fragments. Dedup before queuing.

## Extraction Logic (`extract.ts`)

Per page, in order:

1. Fetch with `Accept: text/markdown, text/html;q=0.9`
2. Check `Content-Type` header **before reading body** — skip non-HTML/non-markdown responses early.
3. Check `<link rel="canonical">` — if it points to a different URL, skip this page (duplicate content).
4. **Markdown response** (`text/markdown`) → use body directly.
5. **HTML response**:
   a. Look for `<script type="application/ld+json">` — if `@type` is `Article`, `BlogPosting`, or `WebPage` and `articleBody` is present, use that field.
   b. Otherwise: find first of `<main>`, `<article>`, `[role=main]`, `#content`, `#main`, `#root`.
   c. Fall back to existing `getMainContent()` from `~/lib/html/parseHTML`.
6. Return extracted text + page title.

## Crawl Orchestrator (`crawl.ts`)

```
discover URLs (parallel)
  → seed priority queue
  → run concurrency-3 worker pool
  → each worker:
      check limits (words, pages, signal) BEFORE fetching
      fetch page
      extract content
      accumulate running word count
      push result
  → stop when: wordCount >= maxWords || signal.aborted || pagesFetched >= maxPages
→ join collected content in discovery-priority order
→ return combined string
```

The AbortSignal is created from `AbortSignal.timeout(maxSeconds * 1000)` and passed to every fetch. Workers check it before each request so no new fetches start after timeout.

## Testing Strategy

Static HTML fixtures in `test/lib/scrape/fixtures/` simulate realistic site structures. Each fixture is a directory with an `index.html` (homepage) and supporting files (`llms.txt`, `sitemap.txt`, etc.).

Test files mock `fetch` using `vi.stubGlobal` to serve fixture content. Tests cover:

- `extract.test.ts`: Markdown passthrough, JSON-LD extraction, HTML main-content extraction, canonical skip, content-type bail-out.
- `discover.test.ts`: llms.txt parsing, robots.txt filtering, sitemap.txt preference over sitemap.xml, RSS feed discovery, nav fallback.
- `crawl.test.ts`: maxWords stops mid-crawl, maxPages respected, timeout signal stops queue, priority ordering (llms.txt URLs first).

## Migration

- Move `crawlSiteCustom`, `discoverUrls`, `fetchSitemapUrls`, `extractNavUrls` out of `sites.server.ts` into `app/lib/scrape/`.
- Update the call in `addSiteToUser` to use the new import path.
- Update `test/lib/sites.server.test.ts` to point `fetchSiteContent` import at `~/lib/scrape`.
- Delete the old `CRAWL_BUDGET_MS` constant from `sites.server.ts`.
