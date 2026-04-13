# Cited Page Health Monitor & Citation Gap Analysis — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Attract SEO professionals by adding (A) a Cited Page Health Monitor that alerts when AI-cited pages break, and (B) a Citation Gap Analysis that shows which competitor domains are cited where yours isn't.

**Architecture:** Three phases: first normalize citation storage into a proper `Citation` table (expand → backfill → contract), then build the page health monitor (new `CitedPage` table + daily cron + alert email + UI), then add gap analysis (pure query logic + UI panel in Citations). All phases build on existing `CitationQueryRun` / `CitationQuery` data.

**Tech Stack:** Prisma + PostgreSQL, React Router loaders, existing cron pattern (`app/routes/cron.*.ts`), React Email, Vitest integration tests against real DB.

**Design doc:** `docs/plans/2026-04-13-cited-page-health-and-gap-analysis-design.md`

---

## Phase 1 — Schema Foundation: Normalize Citations

### Task 1: Add `Citation` model to schema

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add the model**

Add after the `CitationClassification` model:

```prisma
model Citation {
  id           String           @id @default(cuid())
  url          String           @map("url")
  domain       String           @map("domain")
  relationship String?          @map("relationship")
  reason       String?          @map("reason")
  query        CitationQuery    @relation(fields: [queryId], references: [id], onDelete: Cascade)
  queryId      String           @map("query_id")
  run          CitationQueryRun @relation(fields: [runId], references: [id], onDelete: Cascade)
  runId        String           @map("run_id")
  site         Site             @relation(fields: [siteId], references: [id], onDelete: Cascade)
  siteId       String           @map("site_id")
  createdAt    DateTime         @map("created_at") @default(now())

  @@unique([queryId, url])
  @@index([siteId])
  @@index([runId])
  @@map("citations")
}
```

Also add `citations Citation[]` relation field to `CitationQuery`, `CitationQueryRun`, and `Site` models.

**Step 2: Push schema and regenerate**

```bash
pnpm test:db:push
pnpm prisma generate
```

Expected: no errors, `citations` table created.

**Step 3: Verify with typecheck**

```bash
pnpm check:type
```

Expected: no errors.

**Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add Citation model to schema"
```

---

### Task 2: Dual-write Citation records in `singleQueryRepetition`

**Files:**
- Modify: `app/lib/llm-visibility/queryPlatform.ts`
- Modify: `test/lib/llm-visibility/queryPlatform.test.ts`

**Step 1: Write failing test**

Add to the describe block in `test/lib/llm-visibility/queryPlatform.test.ts`:

```ts
it("should create Citation records for each cited URL", {
  timeout: 30_000,
}, async () => {
  const citations = await prisma.citation.findMany({
    where: { siteId: site.id },
    orderBy: { createdAt: "asc" },
  });

  // 2 queries × their URL counts: query[0] has 2 URLs, query[1] has 3 URLs
  expect(citations.length).toBe(5);

  const domains = citations.map((c) => c.domain);
  expect(domains).toContain("rentail.space");
  expect(domains).toContain("other.com");
  expect(domains).toContain("example.com");

  // Each citation has queryId and runId
  for (const c of citations) {
    expect(c.queryId).toBeTruthy();
    expect(c.runId).toBeTruthy();
    expect(c.siteId).toBe(site.id);
  }
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm vitest run test/lib/llm-visibility/queryPlatform.test.ts
```

Expected: FAIL — `citation.findMany` returns empty array.

**Step 3: Implement dual-write in `singleQueryRepetition`**

In `app/lib/llm-visibility/queryPlatform.ts`, after `prisma.citationQuery.create`, add:

```ts
const citationRecord = await prisma.citationQuery.create({
  data: { group, citations, extraQueries, query, runId, text },
});

if (citations.length > 0) {
  await prisma.citation.createMany({
    data: citations.map((url) => ({
      url,
      domain: normalizeDomain(url),
      queryId: citationRecord.id,
      runId,
      siteId: site.id,
    })),
    skipDuplicates: true,
  });
}
```

Add `normalizeDomain` import from `~/lib/isSameDomain`.

**Step 4: Run test to verify it passes**

```bash
pnpm vitest run test/lib/llm-visibility/queryPlatform.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add app/lib/llm-visibility/queryPlatform.ts test/lib/llm-visibility/queryPlatform.test.ts
git commit -m "feat: dual-write Citation records alongside CitationQuery"
```

---

### Task 3: Write `relationship` to `Citation` after sentiment analysis

**Files:**
- Modify: `app/lib/llm-visibility/queryPlatform.ts`
- Modify: `test/lib/llm-visibility/queryPlatform.test.ts`

**Step 1: Write failing test**

Add to `queryPlatform.test.ts` (after Task 2 test, mock `analyzeSentiment`):

```ts
it("should update Citation relationship after sentiment analysis", {
  timeout: 30_000,
}, async () => {
  // Re-run with a mocked sentiment that classifies the rentail.space URL as "direct"
  vi.mock("~/lib/llm-visibility/analyzeSentiment", () => ({
    default: vi.fn().mockResolvedValue({
      label: "positive",
      summary: "Good coverage.",
      citations: [
        { url: "https://rentail.space/listings", relationship: "direct", reason: "Own domain" },
        { url: "https://rentail.space/faq", relationship: "direct", reason: "Own domain" },
      ],
    }),
  }));

  const cited = await prisma.citation.findMany({
    where: { siteId: site.id, relationship: "direct" },
  });
  expect(cited.length).toBeGreaterThan(0);
  expect(cited[0].relationship).toBe("direct");
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm vitest run test/lib/llm-visibility/queryPlatform.test.ts
```

Expected: FAIL — relationship is null.

**Step 3: Update `updateRunSentiment` to write to Citation**

In `updateRunSentiment`, after writing `CitationClassification`, add:

```ts
for (const c of citations) {
  await prisma.citation.updateMany({
    where: { siteId: site.id, runId, url: c.url },
    data: { relationship: c.relationship, reason: c.reason ?? null },
  });
}
```

Keep the `CitationClassification` write for now (dual-write phase).

**Step 4: Run test**

```bash
pnpm vitest run test/lib/llm-visibility/queryPlatform.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add app/lib/llm-visibility/queryPlatform.ts test/lib/llm-visibility/queryPlatform.test.ts
git commit -m "feat: update Citation relationship from sentiment analysis"
```

---

### Task 4: Write and run backfill script

**Files:**
- Create: `scripts/backfill-citations.ts`

**Step 1: Write the script**

```ts
#!/usr/bin/env tsx
import prisma from "../app/lib/prisma.server";
import { normalizeDomain } from "../app/lib/isSameDomain";

const queries = await prisma.citationQuery.findMany({
  select: { id: true, citations: true, runId: true, run: { select: { siteId: true } } },
});

const classifications = await prisma.citationClassification.findMany({
  select: { url: true, runId: true, relationship: true, reason: true },
});

const classMap = new Map(
  classifications.map((c) => [`${c.runId}:${c.url}`, c]),
);

let created = 0;
for (const q of queries) {
  for (const url of q.citations) {
    const cls = classMap.get(`${q.runId}:${url}`);
    try {
      await prisma.citation.upsert({
        where: { queryId_url: { queryId: q.id, url } },
        create: {
          url,
          domain: normalizeDomain(url),
          queryId: q.id,
          runId: q.runId,
          siteId: q.run.siteId,
          relationship: cls?.relationship ?? null,
          reason: cls?.reason ?? null,
        },
        update: {
          relationship: cls?.relationship ?? undefined,
          reason: cls?.reason ?? undefined,
        },
      });
      created++;
    } catch {
      // skip duplicate/invalid
    }
  }
}

console.log(`Backfilled ${created} Citation records`);
await prisma.$disconnect();
```

**Step 2: Run it**

```bash
infisical --env dev run -- tsx scripts/backfill-citations.ts
```

Expected: outputs "Backfilled N Citation records" with no errors.

**Step 3: Verify row count**

```bash
infisical --env dev run -- npx prisma studio
```

Check the `citations` table row count matches expectations.

**Step 4: Commit**

```bash
git add scripts/backfill-citations.ts
git commit -m "feat: add backfill script for Citation records"
```

---

### Task 5: Switch citation reads to use `Citation` table

**Files:**
- Modify: `app/routes/site.$domain_.citations/route.tsx`
- Modify: `app/routes/site.$domain_.citations/TopCompetitors.tsx`
- Modify: `test/lib/topCompetitors.test.ts`

**Step 1: Update the `topCompetitors` function signature**

`topCompetitors` currently takes `{ citations: string[] }[]`. Change it to accept `{ url: string }[]` directly (flat array), removing the per-query nesting:

```ts
export function topCompetitors(
  citations: { url: string }[],
  ownDomain: string,
): { total: number; ownCitations: number; competitors: ... } {
  const counts = new Map<string, number>();
  let total = 0;
  let ownCitations = 0;
  for (const { url } of citations) {
    try {
      const domain = normalizeDomain(url);
      total++;
      if (domain === ownDomain) ownCitations++;
      else if (!nonCompetitors.has(domain) && !nonCompetitors.has(domain.split(".").slice(1).join(".")))
        counts.set(domain, (counts.get(domain) ?? 0) + 1);
    } catch { /* skip */ }
  }
  // ... rest unchanged
}
```

**Step 2: Update topCompetitors tests**

In `test/lib/topCompetitors.test.ts`, update all test data from `[{ citations: ["url1", "url2"] }]` to `[{ url: "url1" }, { url: "url2" }]`.

**Step 3: Run topCompetitors tests**

```bash
pnpm vitest run test/lib/topCompetitors.test.ts
```

Expected: PASS.

**Step 4: Update the citations route loader**

In `app/routes/site.$domain_.citations/route.tsx`, replace the `CitationQueryRun` query that fetches nested `queries` with a direct `Citation` query:

```ts
const [citations, siteQueries] = await Promise.all([
  prisma.citation.findMany({
    where: { siteId: site.id },
    select: { url: true, domain: true, relationship: true, runId: true, queryId: true },
    orderBy: { createdAt: "desc" },
  }),
  prisma.siteQuery.findMany({
    where: { siteId: site.id },
    orderBy: [{ group: "asc" }, { query: "asc" }],
  }),
]);
```

Update `topCompetitors(...)` call to pass `citations` directly.

**Step 5: Run citations tests**

```bash
pnpm vitest run test/routes/site.citations.test.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add app/routes/site.$domain_.citations/ test/lib/topCompetitors.test.ts
git commit -m "refactor: switch citation reads to use Citation table"
```

---

### Task 6: Remove old citation structures (contract phase)

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `app/lib/llm-visibility/queryPlatform.ts`
- Modify: `app/lib/llm-visibility/analyzeSentiment.ts`

**Step 1: Remove `citations String[]` from `CitationQuery`**

In `prisma/schema.prisma`:
- Remove `citations String[] @map("citations")` from `CitationQuery`
- Remove `CitationClassification` model entirely
- Remove `classifications CitationClassification[]` from `CitationQueryRun`
- Remove `citationClassifications CitationClassification[]` from `Site`

**Step 2: Remove dual-write code**

In `queryPlatform.ts`:
- Remove `prisma.citationClassification.createMany(...)` call in `updateRunSentiment`
- Remove the `CitationClassification` import/usage
- Keep `prisma.citation.updateMany(...)` for relationship updates

In `singleQueryRepetition`:
- Change `prisma.citationQuery.create({ data: { citations, ... } })` → remove `citations` from the data

**Step 3: Update `analyzeSentiment` caller**

The `analyzeSentiment` function needs `citations: string[]` per query. Feed it from the `Citation` table. In `updateRunSentiment`, fetch query citations:

```ts
const completedQueries = await prisma.citationQuery.findMany({
  where: { runId },
  include: { citations: { select: { url: true } } },
});
const queriesForSentiment = completedQueries.map((q) => ({
  ...q,
  citations: q.citations.map((c) => c.url),
}));
const { label, summary, citations } = await analyzeSentiment({
  domain: site.domain,
  queries: queriesForSentiment,
  siteSummary: site.summary,
});
```

**Step 4: Push schema**

```bash
pnpm test:db:push && pnpm prisma generate
```

**Step 5: Run full test suite**

```bash
pnpm check:type && pnpm vitest run test/lib/llm-visibility/queryPlatform.test.ts test/lib/topCompetitors.test.ts test/routes/site.citations.test.ts
```

Expected: all PASS.

**Step 6: Commit**

```bash
git add prisma/schema.prisma app/lib/llm-visibility/
git commit -m "refactor: remove CitationQuery.citations[] and CitationClassification (contract phase)"
```

---

## Phase 2 — Feature A: Cited Page Health Monitor

### Task 7: Add `CitedPage` model to schema

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add model**

```prisma
model CitedPage {
  id            String    @id @default(cuid())
  url           String    @map("url")
  site          Site      @relation(fields: [siteId], references: [id], onDelete: Cascade)
  siteId        String    @map("site_id")
  citationCount Int       @map("citation_count") @default(0)
  statusCode    Int?      @map("status_code")
  contentHash   String?   @map("content_hash")
  isHealthy     Boolean   @map("is_healthy")      @default(true)
  lastCheckedAt DateTime? @map("last_checked_at")
  alertSentAt   DateTime? @map("alert_sent_at")
  createdAt     DateTime  @map("created_at")      @default(now())
  updatedAt     DateTime  @map("updated_at")      @updatedAt

  @@unique([siteId, url])
  @@index([siteId])
  @@map("cited_pages")
}
```

Also add `citedPages CitedPage[]` to `Site`.

**Step 2: Push and generate**

```bash
pnpm test:db:push && pnpm prisma generate
```

**Step 3: Typecheck**

```bash
pnpm check:type
```

**Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add CitedPage model to schema"
```

---

### Task 8: Upsert `CitedPage` after each citation run

**Files:**
- Modify: `app/lib/llm-visibility/queryPlatform.ts`
- Modify: `test/lib/llm-visibility/queryPlatform.test.ts`

**Step 1: Write failing test**

Add to `queryPlatform.test.ts`:

```ts
it("should upsert CitedPage for own-domain URLs after run", {
  timeout: 30_000,
}, async () => {
  const pages = await prisma.citedPage.findMany({ where: { siteId: site.id } });
  // rentail.space URLs: /listings and /faq
  expect(pages).toHaveLength(2);
  expect(pages.map((p) => p.url)).toContain("https://rentail.space/listings");
  expect(pages.every((p) => p.citationCount > 0)).toBe(true);
});
```

**Step 2: Run to verify fail**

```bash
pnpm vitest run test/lib/llm-visibility/queryPlatform.test.ts
```

Expected: FAIL.

**Step 3: Add upsert in `queryPlatform`**

At the end of `queryPlatform` (after all queries complete, before the function returns), add a helper call:

```ts
await upsertCitedPages({ siteId: site.id, runId: run.id });
```

Add the helper:

```ts
async function upsertCitedPages({ siteId, runId }: { siteId: string; runId: string }) {
  const ownCitations = await prisma.citation.findMany({
    where: { runId, siteId },
    select: { url: true },
  });

  const urlCounts = new Map<string, number>();
  for (const { url } of ownCitations)
    urlCounts.set(url, (urlCounts.get(url) ?? 0) + 1);

  for (const [url, count] of urlCounts) {
    await prisma.citedPage.upsert({
      where: { siteId_url: { siteId, url } },
      create: { url, siteId, citationCount: count },
      update: { citationCount: { increment: count } },
    });
  }
}
```

Wait — the `Citation` table stores all domains, not just own-domain URLs. We need to filter to own domain. The `Citation` table has a `domain` field. But we need to know the site's domain. Pass it:

```ts
await upsertCitedPages({ siteId: site.id, runId: run.id, domain: site.domain });
```

```ts
async function upsertCitedPages({ siteId, runId, domain }: { siteId: string; runId: string; domain: string }) {
  const ownCitations = await prisma.citation.findMany({
    where: { runId, siteId, domain },
    select: { url: true },
  });
  // ... rest as above
}
```

**Step 4: Run test**

```bash
pnpm vitest run test/lib/llm-visibility/queryPlatform.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add app/lib/llm-visibility/queryPlatform.ts test/lib/llm-visibility/queryPlatform.test.ts
git commit -m "feat: upsert CitedPage records after citation run"
```

---

### Task 9: Create page health checker utility

**Files:**
- Create: `app/lib/citedPageHealth.server.ts`
- Create: `test/lib/citedPageHealth.test.ts`

**Step 1: Write failing test**

```ts
// test/lib/citedPageHealth.test.ts
import { describe, expect, it, vi } from "vitest";
import { checkCitedPageHealth } from "~/lib/citedPageHealth.server";

describe("checkCitedPageHealth", () => {
  it("should return healthy for a 200 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      status: 200,
      text: vi.fn().mockResolvedValue("<html>content</html>"),
    }));

    const result = await checkCitedPageHealth("https://example.com/page");
    expect(result.statusCode).toBe(200);
    expect(result.isHealthy).toBe(true);
    expect(result.contentHash).toBeTruthy();
  });

  it("should return unhealthy for a 404 response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      status: 404,
      text: vi.fn().mockResolvedValue("Not found"),
    }));

    const result = await checkCitedPageHealth("https://example.com/gone");
    expect(result.statusCode).toBe(404);
    expect(result.isHealthy).toBe(false);
  });

  it("should return unhealthy when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    const result = await checkCitedPageHealth("https://down.example.com");
    expect(result.statusCode).toBeNull();
    expect(result.isHealthy).toBe(false);
  });
});
```

**Step 2: Run to verify fail**

```bash
pnpm vitest run test/lib/citedPageHealth.test.ts
```

Expected: FAIL — module not found.

**Step 3: Implement**

```ts
// app/lib/citedPageHealth.server.ts
import { createHash } from "node:crypto";

export async function checkCitedPageHealth(url: string): Promise<{
  statusCode: number | null;
  contentHash: string | null;
  isHealthy: boolean;
}> {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": "cite.me.in/1.0 (page health monitor)" },
      signal: AbortSignal.timeout(10_000),
      redirect: "follow",
    });
    const text = await response.text();
    const contentHash = createHash("sha256").update(text.slice(0, 50_000)).digest("hex");
    const isHealthy = response.status >= 200 && response.status < 400;
    return { statusCode: response.status, contentHash, isHealthy };
  } catch {
    return { statusCode: null, contentHash: null, isHealthy: false };
  }
}
```

**Step 4: Run test**

```bash
pnpm vitest run test/lib/citedPageHealth.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add app/lib/citedPageHealth.server.ts test/lib/citedPageHealth.test.ts
git commit -m "feat: add citedPageHealth utility"
```

---

### Task 10: Create cron job for page health checks

**Files:**
- Create: `app/routes/cron.check-cited-pages.ts`
- Create: `test/routes/cron.check-cited-pages.test.ts`

**Step 1: Write failing test**

```ts
// test/routes/cron.check-cited-pages.test.ts
import { beforeAll, describe, expect, it, vi } from "vitest";
import prisma from "~/lib/prisma.server";

vi.mock("~/lib/citedPageHealth.server", () => ({
  checkCitedPageHealth: vi.fn().mockResolvedValue({
    statusCode: 200,
    contentHash: "abc123",
    isHealthy: true,
  }),
}));

vi.mock("~/lib/envVars.server", () => ({
  default: { CRON_SECRET: "test-secret" },
}));

describe("cron.check-cited-pages", () => {
  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { id: "user-ccp-1", email: "ccp@test.com", passwordHash: "x" },
    });
    const site = await prisma.site.create({
      data: {
        id: "site-ccp-1",
        domain: "example.com",
        ownerId: user.id,
        content: "",
        summary: "",
        apiKey: "key-ccp-1",
      },
    });
    await prisma.citedPage.create({
      data: { id: "page-ccp-1", url: "https://example.com/guide", siteId: site.id, citationCount: 5 },
    });
  });

  it("should check health and update CitedPage record", async () => {
    const { loader } = await import("~/routes/cron.check-cited-pages");
    const request = new Request("http://localhost/cron/check-cited-pages", {
      headers: { authorization: "Bearer test-secret" },
    });
    const response = await loader({ request, params: {}, context: {} } as never);
    const body = await response.json();
    expect(body.ok).toBe(true);

    const page = await prisma.citedPage.findUnique({ where: { id: "page-ccp-1" } });
    expect(page?.statusCode).toBe(200);
    expect(page?.isHealthy).toBe(true);
    expect(page?.lastCheckedAt).toBeTruthy();
  });

  it("should reject requests without auth", async () => {
    const { loader } = await import("~/routes/cron.check-cited-pages");
    const request = new Request("http://localhost/cron/check-cited-pages");
    await expect(loader({ request, params: {}, context: {} } as never)).rejects.toThrow();
  });
});
```

**Step 2: Run to verify fail**

```bash
pnpm vitest run test/routes/cron.check-cited-pages.test.ts
```

Expected: FAIL — module not found.

**Step 3: Implement the cron route**

```ts
// app/routes/cron.check-cited-pages.ts
import { data } from "react-router";
import captureAndLogError from "~/lib/captureAndLogError.server";
import envVars from "~/lib/envVars.server";
import { checkCitedPageHealth } from "~/lib/citedPageHealth.server";
import prisma from "~/lib/prisma.server";
import { sendCitedPageAlertEmail } from "~/emails/CitedPageAlert";
import type { Route } from "./+types/cron.check-cited-pages";

export const config = { maxDuration: 300 };

const STALE_HOURS = 24;

export async function loader({ request }: Route.LoaderArgs) {
  if (request.headers.get("authorization") !== `Bearer ${envVars.CRON_SECRET}`)
    throw new Response("Unauthorized", { status: 401 });

  try {
    const staleThreshold = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000);
    const pages = await prisma.citedPage.findMany({
      where: {
        OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: staleThreshold } }],
      },
      include: { site: { select: { domain: true, ownerId: true } } },
      take: 100,
      orderBy: { citationCount: "desc" },
    });

    const results = [];
    for (const page of pages) {
      const { statusCode, contentHash, isHealthy } = await checkCitedPageHealth(page.url);
      const wasHealthy = page.isHealthy;

      await prisma.citedPage.update({
        where: { id: page.id },
        data: { statusCode, contentHash, isHealthy, lastCheckedAt: new Date() },
      });

      if (wasHealthy && !isHealthy) {
        await sendCitedPageAlertEmail({ page, siteOwnerId: page.site.ownerId });
      }

      results.push({ url: page.url, statusCode, isHealthy });
    }

    return data({ ok: true, checked: results.length, results });
  } catch (error) {
    captureAndLogError(error, { extra: { step: "check-cited-pages" } });
    return data({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}
```

**Step 4: Run test**

```bash
pnpm vitest run test/routes/cron.check-cited-pages.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add app/routes/cron.check-cited-pages.ts test/routes/cron.check-cited-pages.test.ts
git commit -m "feat: add cron job for cited page health checks"
```

---

### Task 11: Alert email for broken cited page

**Files:**
- Create: `app/emails/CitedPageAlert.tsx`

**Step 1: Implement**

Follow the pattern of existing email helpers (e.g. `app/emails/TrialEnded.ts`). Use `SentEmail` for deduplication — don't re-alert for the same broken page within 7 days.

```tsx
// app/emails/CitedPageAlert.tsx
import { render } from "@react-email/components";
import { Resend } from "resend";
import prisma from "~/lib/prisma.server";
import envVars from "~/lib/envVars.server";
import captureAndLogError from "~/lib/captureAndLogError.server";

const resend = new Resend(envVars.RESEND_API_KEY);
const DEDUP_KEY = (pageId: string) => `cited-page-alert:${pageId}`;
const DEDUP_DAYS = 7;

export async function sendCitedPageAlertEmail({
  page,
  siteOwnerId,
}: {
  page: { id: string; url: string; citationCount: number; site: { domain: string } };
  siteOwnerId: string;
}) {
  const dedupKey = DEDUP_KEY(page.id);
  const threshold = new Date(Date.now() - DEDUP_DAYS * 24 * 60 * 60 * 1000);

  const already = await prisma.sentEmail.findFirst({
    where: { userId: siteOwnerId, type: dedupKey, sentAt: { gt: threshold } },
  });
  if (already) return;

  const user = await prisma.user.findUnique({ where: { id: siteOwnerId }, select: { email: true } });
  if (!user || user.unsubscribed) return;

  try {
    await resend.emails.send({
      from: "Cite.me.in <alerts@cite.me.in>",
      to: user.email,
      subject: `Cited page is down: ${page.url}`,
      html: `<p>A page on <strong>${page.site.domain}</strong> that has been cited ${page.citationCount} times is no longer responding:</p><p><a href="${page.url}">${page.url}</a></p><p>AI platforms may stop citing this page until it is restored.</p>`,
    });

    await prisma.sentEmail.create({ data: { userId: siteOwnerId, type: dedupKey } });
  } catch (error) {
    captureAndLogError(error, { extra: { pageId: page.id } });
  }
}
```

**Step 2: Typecheck**

```bash
pnpm check:type
```

Expected: no errors.

**Step 3: Commit**

```bash
git add app/emails/CitedPageAlert.tsx
git commit -m "feat: add cited page alert email"
```

---

### Task 12: Cited Pages UI route

**Files:**
- Create: `app/routes/site.$domain_.pages/route.tsx`
- Modify: `app/components/ui/SiteNav.tsx` (or wherever the site nav is defined)

**Step 1: Find the site nav component**

```bash
grep -r "siteNav" app/components/ app/routes/site.\$domain/ --include="*.tsx" -l
```

**Step 2: Implement the route**

```tsx
// app/routes/site.$domain_.pages/route.tsx
import Main from "~/components/ui/Main";
import SitePageHeader from "~/components/ui/SiteHeading";
import { requireSiteAccess } from "~/lib/auth.server";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/route";

export const handle = { siteNav: true };

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `Cited Pages — ${loaderData?.site.domain} | Cite.me.in` }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { site } = await requireSiteAccess({ domain: params.domain, request });

  const pages = await prisma.citedPage.findMany({
    where: { siteId: site.id },
    orderBy: { citationCount: "desc" },
  });

  return { site, pages };
}

export default function SitePagesRoute({ loaderData }: Route.ComponentProps) {
  const { site, pages } = loaderData;
  const healthy = pages.filter((p) => p.isHealthy).length;
  const broken = pages.filter((p) => !p.isHealthy && p.lastCheckedAt).length;

  return (
    <Main>
      <SitePageHeader title="Cited Pages" domain={site.domain} />
      <div className="mb-4 flex gap-6 text-sm">
        <span className="text-green-700">{healthy} healthy</span>
        {broken > 0 && <span className="text-red-700 font-medium">{broken} broken</span>}
      </div>
      {pages.length === 0 ? (
        <p className="text-foreground/60">No cited pages yet — run a citation check to populate this list.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-foreground/60">
              <th className="pb-2 font-medium">Page</th>
              <th className="pb-2 font-medium text-right">Citations</th>
              <th className="pb-2 font-medium text-right">Status</th>
              <th className="pb-2 font-medium text-right">Last checked</th>
            </tr>
          </thead>
          <tbody>
            {pages.map((page) => (
              <tr key={page.id} className="border-b last:border-0">
                <td className="py-2 pr-4">
                  <a href={page.url} target="_blank" rel="noreferrer" className="truncate font-medium hover:underline max-w-xs block">
                    {new URL(page.url).pathname}
                  </a>
                  <span className="text-foreground/50 text-xs">{new URL(page.url).hostname}</span>
                </td>
                <td className="py-2 text-right">{page.citationCount}</td>
                <td className="py-2 text-right">
                  {!page.lastCheckedAt ? (
                    <span className="text-foreground/40">Pending</span>
                  ) : page.isHealthy ? (
                    <span className="text-green-700">✓ {page.statusCode}</span>
                  ) : (
                    <span className="text-red-700 font-medium">✗ {page.statusCode ?? "Unreachable"}</span>
                  )}
                </td>
                <td className="py-2 text-right text-foreground/50">
                  {page.lastCheckedAt ? new Date(page.lastCheckedAt).toLocaleDateString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Main>
  );
}
```

**Step 3: Add "Pages" to site nav**

Find the nav definition (likely in `app/components/ui/SiteHeading.tsx` or a nav component) and add a "Pages" link pointing to `/site/${domain}/pages`.

**Step 4: Typecheck**

```bash
pnpm check:type
```

**Step 5: Commit**

```bash
git add app/routes/site.$domain_.pages/ app/components/
git commit -m "feat: add Cited Pages UI route"
```

---

## Phase 3 — Feature B: Citation Gap Analysis

### Task 13: Implement citation gap analysis logic

**Files:**
- Create: `app/lib/citationGapAnalysis.server.ts`
- Create: `test/lib/citationGapAnalysis.test.ts`

**Step 1: Write failing test**

```ts
// test/lib/citationGapAnalysis.test.ts
import { describe, expect, it } from "vitest";
import { getCitationGaps } from "~/lib/citationGapAnalysis.server";

describe("getCitationGaps", () => {
  it("should identify queries where competitor appears but own domain does not", () => {
    const citations = [
      { url: "https://competitor.com/a", domain: "competitor.com", queryId: "q1" },
      { url: "https://mysite.com/page",  domain: "mysite.com",     queryId: "q1" },
      { url: "https://competitor.com/b", domain: "competitor.com", queryId: "q2" },
      // q2: competitor cited, mysite not cited
    ];
    const queries = [
      { id: "q1", query: "how to find retail space" },
      { id: "q2", query: "short term retail leasing" },
    ];

    const gaps = getCitationGaps({ citations, queries, ownDomain: "mysite.com" });

    expect(gaps).toHaveLength(1);
    expect(gaps[0].competitorDomain).toBe("competitor.com");
    expect(gaps[0].queries).toHaveLength(1);
    expect(gaps[0].queries[0].query).toBe("short term retail leasing");
  });

  it("should return empty when own domain appears in all queries with competitor", () => {
    const citations = [
      { url: "https://competitor.com/a", domain: "competitor.com", queryId: "q1" },
      { url: "https://mysite.com/page",  domain: "mysite.com",     queryId: "q1" },
    ];
    const queries = [{ id: "q1", query: "query one" }];

    const gaps = getCitationGaps({ citations, queries, ownDomain: "mysite.com" });
    expect(gaps).toHaveLength(0);
  });

  it("should exclude non-competitor domains", () => {
    const citations = [
      { url: "https://reddit.com/r/retail", domain: "reddit.com", queryId: "q1" },
    ];
    const queries = [{ id: "q1", query: "query one" }];
    const gaps = getCitationGaps({ citations, queries, ownDomain: "mysite.com" });
    expect(gaps).toHaveLength(0);
  });
});
```

**Step 2: Run to verify fail**

```bash
pnpm vitest run test/lib/citationGapAnalysis.test.ts
```

Expected: FAIL — module not found.

**Step 3: Implement**

```ts
// app/lib/citationGapAnalysis.server.ts
import nonCompetitors from "~/routes/site.$domain_.citations/nonCompetitors";

export function getCitationGaps({
  citations,
  queries,
  ownDomain,
}: {
  citations: { url: string; domain: string; queryId: string }[];
  queries: { id: string; query: string }[];
  ownDomain: string;
}): { competitorDomain: string; queries: { id: string; query: string }[] }[] {
  const queryMap = new Map(queries.map((q) => [q.id, q]));

  // Build sets: queryIds where own domain appears, and map of competitor → queryIds
  const ownQueryIds = new Set(
    citations.filter((c) => c.domain === ownDomain).map((c) => c.queryId),
  );

  const competitorQueries = new Map<string, Set<string>>();
  for (const c of citations) {
    if (c.domain === ownDomain) continue;
    if (nonCompetitors.has(c.domain)) continue;
    if (nonCompetitors.has(c.domain.split(".").slice(1).join("."))) continue;
    if (!competitorQueries.has(c.domain)) competitorQueries.set(c.domain, new Set());
    competitorQueries.get(c.domain)!.add(c.queryId);
  }

  const gaps: { competitorDomain: string; queries: { id: string; query: string }[] }[] = [];
  for (const [domain, queryIds] of competitorQueries) {
    const gapQueryIds = [...queryIds].filter((id) => !ownQueryIds.has(id));
    if (gapQueryIds.length === 0) continue;
    gaps.push({
      competitorDomain: domain,
      queries: gapQueryIds.map((id) => queryMap.get(id)!).filter(Boolean),
    });
  }

  return gaps.sort((a, b) => b.queries.length - a.queries.length);
}
```

**Step 4: Run test**

```bash
pnpm vitest run test/lib/citationGapAnalysis.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add app/lib/citationGapAnalysis.server.ts test/lib/citationGapAnalysis.test.ts
git commit -m "feat: add citation gap analysis logic"
```

---

### Task 14: Add Gap Analysis UI to Citations page

**Files:**
- Create: `app/routes/site.$domain_.citations/CitationGapAnalysis.tsx`
- Modify: `app/routes/site.$domain_.citations/route.tsx`

**Step 1: Update loader to include gap analysis data**

In `route.tsx` loader, after fetching citations and siteQueries, add:

```ts
import { getCitationGaps } from "~/lib/citationGapAnalysis.server";

// In loader, after fetching citations:
const gaps = getCitationGaps({
  citations,
  queries: siteQueries.map((sq) => ({ id: sq.id, query: sq.query })),
  ownDomain: site.domain,
});

return { site, citations, siteQueries, competitors, shareOfVoice, gaps };
```

**Step 2: Implement the component**

```tsx
// app/routes/site.$domain_.citations/CitationGapAnalysis.tsx
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/Card";
import { Badge } from "~/components/ui/Badge";

export default function CitationGapAnalysis({
  gaps,
}: {
  gaps: { competitorDomain: string; queries: { id: string; query: string }[] }[];
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (gaps.length === 0)
    return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Citation Gaps</CardTitle>
        <CardDescription className="text-foreground/60">
          Competitors cited where you are not
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2">
          {gaps.map(({ competitorDomain, queries }) => (
            <div key={competitorDomain} className="border-b last:border-0 pb-2">
              <button
                type="button"
                className="flex w-full items-center justify-between py-1 font-medium hover:text-foreground/70"
                onClick={() => setExpanded(expanded === competitorDomain ? null : competitorDomain)}
              >
                <span>{competitorDomain}</span>
                <Badge variant="neutral">{queries.length} {queries.length === 1 ? "query" : "queries"}</Badge>
              </button>
              {expanded === competitorDomain && (
                <ul className="mt-1 ml-4 flex flex-col gap-1">
                  {queries.map((q) => (
                    <li key={q.id} className="text-sm text-foreground/60">— {q.query}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 3: Add to Citations page**

In `route.tsx` component, add `<CitationGapAnalysis gaps={gaps} />` alongside `<TopCompetitors ... />`.

**Step 4: Typecheck and run tests**

```bash
pnpm check:type
pnpm vitest run test/routes/site.citations.test.ts
```

**Step 5: Commit**

```bash
git add app/routes/site.$domain_.citations/
git commit -m "feat: add Citation Gap Analysis UI to citations page"
```

---

## Final Verification

**Step 1: Run full test suite**

```bash
pnpm check:type && pnpm vitest run
```

Expected: all pass.

**Step 2: Lint**

```bash
pnpm check:lint
```

Expected: no errors.
