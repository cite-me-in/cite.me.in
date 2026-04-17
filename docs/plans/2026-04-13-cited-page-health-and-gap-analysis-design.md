# Cited Page Health Monitor & Citation Gap Analysis — Design

## Motivation

[LynkDog](https://lynkdog.com) is a competitor targeting SEO agencies with the pitch: _"Your backlinks power your AEO/GEO visibility — when links break, you disappear from ChatGPT and Perplexity."_ Their product monitors traditional backlinks and reframes it as an AI visibility tool.

cite.me.in has a stronger position: we measure actual AI citations, not a proxy signal. These two features turn that data advantage into a direct counter-offer to the SEO agency audience LynkDog targets.

## Target Audience

SEO professionals and agencies. They think in alerts, audits, and client reports. They currently use LynkDog, Ahrefs, or SEMrush and understand link health monitoring. The goal is to give them a reason to use cite.me.in alongside or instead of LynkDog.

Both features fit within the existing product — an SEO agency signs up, adds their clients' sites, and gets these capabilities alongside the existing citations, queries, and bots views.

---

## Feature A: Cited Page Health Monitor

### What it does

cite.me.in already records which specific URLs AI platforms cite for each query. This feature monitors the health of those cited URLs: are they still live? Have they changed? If a cited page breaks or redirects, that citation is at risk.

New nav tab: `site.$domain_.pages` — "Cited Pages"

### How it works

1. After each citation run, extract all distinct URLs from the site's citations and upsert them into a `CitedPage` table.
2. A background job runs daily: HTTP GET each cited URL, record the status code and a content hash.
3. If a page transitions from healthy (2xx) to broken (4xx/5xx), redirected (3xx to a different path), or significantly changed content, mark it as at-risk and send an alert email.
4. The UI shows a table of cited pages sorted by citation count, with health status badges and a sparkline of status history.

### Pitch to SEO agencies

_"We don't just tell you when AI cites you — we tell you when those cited pages are broken."_ This is more directly useful than LynkDog's backlink monitoring because it targets the exact pages AI is using, not a proxy.

---

## Feature B: Citation Gap Analysis

### What it does

For each competitor that appears in the user's citation data, show which specific queries they're cited for that the user's site isn't. "Competitor X appears in 8 of 10 queries about Y — you appear in 2. Here's the gap."

This builds on the existing TopCompetitors view and adds query-level detail.

### How it works

Uses the new `Citation` table (see schema section below). For each query, compare which domains appear in citations. For any competitor domain that outperforms the user's domain, surface the specific queries where they appear and the user doesn't.

The UI adds a "Gap Analysis" panel to the existing `site.$domain_.citations` route — a table of competitors with expandable rows showing the specific queries where they have citation share the user lacks.

### Pitch to SEO agencies

A content gap deliverable they can take to clients: "Here's exactly which topics your competitors are getting cited for that you're not."

---

## Schema Changes

### Problem with current structure

- `CitationQuery.citations: String[]` stores raw cited URLs as an array — hard to query, no classification, no deduplication.
- `CitationClassification` stores `url + relationship + reason` per run+site but has no query-level link, so you can't tell which query generated which citation.

### New `Citation` table

```prisma
model Citation {
  id           String        @id @default(cuid())
  url          String        @map("url")
  domain       String        @map("domain")        // extracted hostname for grouping
  relationship String        @map("relationship")  // direct / indirect / unrelated
  reason       String?       @map("reason")
  query        CitationQuery @relation(fields: [queryId], references: [id], onDelete: Cascade)
  queryId      String        @map("query_id")
  site         Site          @relation(fields: [siteId], references: [id], onDelete: Cascade)
  siteId       String        @map("site_id")
  createdAt    DateTime      @map("created_at")    @default(now())

  @@unique([queryId, url])
  @@index([siteId])
  @@index([queryId])
  @@map("citations")
}
```

`CitationClassification` is deprecated and removed after migration.

### Migration strategy: expand → migrate → contract

**Phase 1 — Expand (additive, no breakage)**

- Add `Citation` table to schema; keep `CitationQuery.citations[]` untouched.
- Update the citation runner to dual-write: populate both `citations[]` and `Citation` records.
- Deploy schema + code.
- Before removing `CitationClassification`, audit where the LLM classification step runs and ensure it writes to `Citation.relationship` going forward.

**Phase 2 — Backfill + cut over reads**

- Run a one-time backfill script: extract each URL from `CitationQuery.citations[]`, join with `CitationClassification` where available to carry over `relationship`/`reason`, insert into `Citation`.
- Switch all reads (citations page, TopCompetitors, VisibilityCharts, gap analysis) to use `Citation`.
- Deploy code, verify.

**Phase 3 — Contract (remove old)**

- Remove `citations[]` from `CitationQuery`.
- Remove `CitationClassification` table.
- Remove dual-write code from citation runner.
- Deploy schema + code.

---

## New `CitedPage` table (for Feature A)

```prisma
model CitedPage {
  id              String    @id @default(cuid())
  url             String    @map("url")
  site            Site      @relation(fields: [siteId], references: [id], onDelete: Cascade)
  siteId          String    @map("site_id")
  citationCount   Int       @map("citation_count")   @default(0)
  statusCode      Int?      @map("status_code")
  contentHash     String?   @map("content_hash")
  isHealthy       Boolean   @map("is_healthy")        @default(true)
  lastCheckedAt   DateTime? @map("last_checked_at")
  alertSentAt     DateTime? @map("alert_sent_at")
  createdAt       DateTime  @map("created_at")        @default(now())
  updatedAt       DateTime  @map("updated_at")        @updatedAt

  @@unique([siteId, url])
  @@index([siteId])
  @@map("cited_pages")
}
```

---

## Implementation Phases

### Phase 1: Schema foundation

1. Add `Citation` table
2. Update citation runner to dual-write
3. Write + run backfill script
4. Switch reads to `Citation`
5. Remove `CitationQuery.citations[]` and `CitationClassification`

### Phase 2: Feature A — Cited Page Health Monitor

1. Add `CitedPage` table
2. Background job: crawl cited pages daily, update health status
3. Alert email when page becomes unhealthy
4. New route `site.$domain_.pages` with health dashboard UI

### Phase 3: Feature B — Citation Gap Analysis

1. Query logic: find queries where competitor domain appears, user domain doesn't
2. UI panel in `site.$domain_.citations`: Gap Analysis section with competitor+query breakdown
