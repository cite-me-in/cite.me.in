# Query Citation Trigger Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Automatically run citations on all AI platforms when a query is added or meaningfully updated, with guards to skip non-sentence queries and whitespace-only edits.

**Architecture:** Add two pure utility functions (`isMeaningfulSentence`, `hasWordChanges`) for validation, a new `runQueryOnAllPlatforms` function that bypasses the site-wide 24h run check (but still respects per-query dedup), gate both `add-query` and `update-query` actions behind these checks, and write a one-off script to backfill citations for existing queries.

**Tech Stack:** TypeScript, Prisma, Vercel AI SDK, existing `queryPlatform` / `singleQueryRepetition` infrastructure, `tsx` for scripts.

---

### Task 1: Add `isMeaningfulSentence` and `hasWordChanges` utility functions

**Files:**
- Create: `app/lib/llm-visibility/queryValidation.ts`
- Test: `test/lib/queryValidation.test.ts`

**Context:**
- `isMeaningfulSentence`: strips punctuation/symbols, splits on whitespace, returns true if ≥ 3 word tokens remain.
- `hasWordChanges`: normalises both strings (lowercase, strip non-alphanumeric, collapse whitespace), returns true if they differ.

**Step 1: Write the failing tests**

Create `test/lib/queryValidation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  hasWordChanges,
  isMeaningfulSentence,
} from "~/lib/llm-visibility/queryValidation";

describe("isMeaningfulSentence", () => {
  it("should return true for a full question", () => {
    expect(isMeaningfulSentence("what is the best weather app?")).toBe(true);
  });
  it("should return true for a short 3-word query", () => {
    expect(isMeaningfulSentence("best weather app")).toBe(true);
  });
  it("should return false for empty string", () => {
    expect(isMeaningfulSentence("")).toBe(false);
  });
  it("should return false for a single word", () => {
    expect(isMeaningfulSentence("weather")).toBe(false);
  });
  it("should return false for two words", () => {
    expect(isMeaningfulSentence("weather app")).toBe(false);
  });
  it("should return false for punctuation only", () => {
    expect(isMeaningfulSentence("??? !!!")).toBe(false);
  });
});

describe("hasWordChanges", () => {
  it("should return false when only punctuation differs", () => {
    expect(hasWordChanges("weather app?", "weather app!")).toBe(false);
  });
  it("should return false when only whitespace differs", () => {
    expect(hasWordChanges("weather  app", "weather app")).toBe(false);
  });
  it("should return false when only case differs", () => {
    expect(hasWordChanges("Weather App", "weather app")).toBe(false);
  });
  it("should return true when a word is replaced", () => {
    expect(hasWordChanges("best weather app", "best weather tool")).toBe(true);
  });
  it("should return true when a word is added", () => {
    expect(hasWordChanges("weather app", "best weather app")).toBe(true);
  });
  it("should return true when a word is removed", () => {
    expect(hasWordChanges("best weather app", "weather app")).toBe(true);
  });
});
```

**Step 2: Run to verify they fail**

```bash
pnpm vitest run test/lib/queryValidation.test.ts
```

Expected: FAIL — module not found.

**Step 3: Implement `app/lib/llm-visibility/queryValidation.ts`**

```ts
function normalizeWords(query: string): string {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isMeaningfulSentence(query: string): boolean {
  const words = normalizeWords(query).split(" ").filter(Boolean);
  return words.length >= 3;
}

export function hasWordChanges(oldQuery: string, newQuery: string): boolean {
  return normalizeWords(oldQuery) !== normalizeWords(newQuery);
}
```

**Step 4: Run tests to verify they pass**

```bash
pnpm vitest run test/lib/queryValidation.test.ts
```

Expected: all 12 tests PASS.

**Step 5: Commit**

```bash
git add app/lib/llm-visibility/queryValidation.ts test/lib/queryValidation.test.ts
git commit -m "feat: add isMeaningfulSentence and hasWordChanges query validators"
```

---

### Task 2: Add `runQueryOnAllPlatforms` — per-query citation trigger

**Files:**
- Modify: `app/lib/addSiteQueries.ts`

**Context:**
The existing `queryAccount` creates a run only if no run exists in the last 24h for the whole site+platform. That's fine for scheduled full scans but wrong for individual query saves — if any run exists in the last 24h, all subsequent per-query updates are silently skipped.

We need a new function that:
1. Finds the most recent `CitationQueryRun` for each platform+site (or creates one).
2. Calls `singleQueryRepetition` for the given query (which has its own per-query dedup).

The problem: `singleQueryRepetition` is not exported from `queryPlatform.ts`. We need to either export it or inline equivalent logic. The cleanest approach is to export it.

**Step 1: Export `singleQueryRepetition` from `queryPlatform.ts`**

In `app/lib/llm-visibility/queryPlatform.ts`, change:

```ts
async function singleQueryRepetition({
```

to:

```ts
export async function singleQueryRepetition({
```

**Step 2: Add `runQueryOnAllPlatforms` to `addSiteQueries.ts`**

Add this import at the top of `app/lib/addSiteQueries.ts`:

```ts
import { singleQueryRepetition } from "./llm-visibility/queryPlatform";
import queryClaude from "./llm-visibility/claudeClient";
import queryGemini from "./llm-visibility/geminiClient";
import openaiClient from "./llm-visibility/openaiClient";
import queryPerplexity from "./llm-visibility/perplexityClient";
import prisma from "./prisma.server";
```

Note: `prisma` is already imported; don't duplicate it.

Add the function after `updateSiteQuery`:

```ts
const PLATFORMS = [
  { platform: "chatgpt", modelId: "gpt-5-chat-latest", queryFn: openaiClient },
  { platform: "perplexity", modelId: "sonar", queryFn: queryPerplexity },
  { platform: "claude", modelId: "claude-haiku-4-5-20251001", queryFn: queryClaude },
  { platform: "gemini", modelId: "gemini-2.5-flash", queryFn: queryGemini },
] as const;

export async function runQueryOnAllPlatforms({
  site,
  query,
  group,
}: {
  site: { id: string; domain: string };
  query: string;
  group: string;
}) {
  await Promise.all(
    PLATFORMS.map(async ({ platform, modelId, queryFn }) => {
      const run =
        (await prisma.citationQueryRun.findFirst({
          where: { platform, siteId: site.id },
          orderBy: { createdAt: "desc" },
        })) ??
        (await prisma.citationQueryRun.create({
          data: { platform, model: modelId, siteId: site.id },
        }));

      await singleQueryRepetition({
        siteId: site.id,
        group,
        modelId,
        platform,
        query,
        queryFn,
        runId: run.id,
        site,
      });
    }),
  );
}
```

**Step 3: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

**Step 4: Commit**

```bash
git add app/lib/llm-visibility/queryPlatform.ts app/lib/addSiteQueries.ts
git commit -m "feat: add runQueryOnAllPlatforms for per-query citation trigger"
```

---

### Task 3: Gate `add-query` and `update-query` actions behind validators

**Files:**
- Modify: `app/routes/site.$domain_.queries/route.tsx`

**Context:**
- `add-query`: call `runQueryOnAllPlatforms` only when `isMeaningfulSentence(query)` is true. The existing `addSiteQueries` call still saves the query to DB regardless.
- `update-query`: call `runQueryOnAllPlatforms` only when `isMeaningfulSentence(newQuery) && hasWordChanges(existing.query, newQuery)`.
- The existing `updateSiteQuery` still runs `queryAccount` — replace its call with direct DB update + conditional `runQueryOnAllPlatforms`.

**Step 1: Update `updateSiteQuery` in `addSiteQueries.ts` to not auto-run**

Change `updateSiteQuery` to only update the DB (remove the `queryAccount` call):

```ts
export async function updateSiteQuery(id: string, query: string) {
  await prisma.siteQuery.update({
    data: { query: trimQuery(query) },
    where: { id },
  });
}
```

The caller (the route action) will decide whether to also call `runQueryOnAllPlatforms`.

**Step 2: Update the route action**

In `app/routes/site.$domain_.queries/route.tsx`, add imports:

```ts
import { runQueryOnAllPlatforms } from "~/lib/addSiteQueries";
import {
  hasWordChanges,
  isMeaningfulSentence,
} from "~/lib/llm-visibility/queryValidation";
```

Replace the `add-query` case:

```ts
case "add-query": {
  const group = data.get("group")?.toString() ?? "";
  const query = data.get("query")?.toString() ?? "";
  await addSiteQueries(site, [{ group, query }]);
  if (isMeaningfulSentence(query))
    await runQueryOnAllPlatforms({ site, query: query.trim(), group });
  return { ok: true };
}
```

Replace the `update-query` case:

```ts
case "update-query": {
  const id = data.get("id")?.toString() ?? "";
  const query = data.get("query")?.toString() ?? "";
  const existing = await prisma.siteQuery.findFirst({
    where: { id, siteId: site.id },
  });
  if (!existing) return { ok: false as const, error: "Query not found" };
  await updateSiteQuery(id, query);
  if (
    isMeaningfulSentence(query) &&
    hasWordChanges(existing.query, query)
  )
    await runQueryOnAllPlatforms({ site, query: query.trim(), group: existing.group });
  return { ok: true as const };
}
```

**Step 3: Also update `addSiteQueries` — remove the `queryAccount` call**

`addSiteQueries` currently calls `queryAccount` at the end. Since the route now calls `runQueryOnAllPlatforms` per-query after `addSiteQueries`, remove the `queryAccount` call from `addSiteQueries` to avoid double-running.

In `app/lib/addSiteQueries.ts`, remove:
```ts
// Remove this line from addSiteQueries:
await queryAccount({ site, queries: unique });
```

Also remove the `queryAccount` import if it's no longer used.

**Step 4: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

**Step 5: Commit**

```bash
git add app/routes/site.$domain_.queries/route.tsx app/lib/addSiteQueries.ts
git commit -m "feat: gate citation runs on sentence validation and word changes"
```

---

### Task 4: Write `scripts/run-queries.ts` backfill script

**Files:**
- Create: `scripts/run-queries.ts`

**Context:**
Existing queries have 0 citations because `queryAccount` was silently skipping them (24h run check). This script loads all queries for a domain and runs `runQueryOnAllPlatforms` for each, bypassing the 24h check at the platform level (since `runQueryOnAllPlatforms` uses "most recent run, or create" logic).

**Step 1: Create the script**

```ts
#!/usr/bin/env tsx

/**
 * Backfill citation runs for all existing queries of a site.
 *
 * Usage: ./scripts/run-queries.ts <domain>
 */

import "../app/lib/env.server";
import { runQueryOnAllPlatforms } from "../app/lib/addSiteQueries";
import prisma from "../app/lib/prisma.server";

const domain = process.argv[2];
if (!domain) {
  console.error("Usage: ./scripts/run-queries.ts <domain>");
  process.exit(1);
}

const site = await prisma.site.findFirst({ where: { domain } });
if (!site) {
  console.error("Site not found: %s", domain);
  process.exit(1);
}

const queries = await prisma.siteQuery.findMany({
  where: { siteId: site.id },
  orderBy: [{ group: "asc" }, { createdAt: "asc" }],
});

const meaningful = queries.filter(
  (q) => q.query.trim().split(/\s+/).filter(Boolean).length >= 3,
);

console.info(
  "Running %d queries for %s (skipping %d non-sentences)…",
  meaningful.length,
  domain,
  queries.length - meaningful.length,
);

for (const q of meaningful) {
  console.info("  [%s] %s", q.group, q.query);
  await runQueryOnAllPlatforms({ site, query: q.query, group: q.group });
}

console.info("Done.");
```

**Step 2: Make it executable**

```bash
chmod +x scripts/run-queries.ts
```

**Step 3: Dry-run (check it resolves without API calls — optional)**

You can verify the script loads correctly without actually hitting APIs by checking it exits cleanly with a bad domain:

```bash
./scripts/run-queries.ts nonexistent-domain.xyz
```

Expected: `Site not found: nonexistent-domain.xyz`

**Step 4: Run it for the real site**

```bash
./scripts/run-queries.ts cite.me.in
```

Expected: lists meaningful queries and processes them. Takes a few minutes.

**Step 5: Commit**

```bash
git add scripts/run-queries.ts
git commit -m "chore: add run-queries backfill script"
```

---

### Task 5: Check for env loading in scripts

**Context:**
Scripts need env vars (DATABASE_URL, API keys). Check how `crawl.ts` loads env — it likely uses a dotenv import or `env.server.ts`. Confirm `run-queries.ts` uses the same pattern.

Look at `app/lib/env.server.ts` to see what it exports, and whether `crawl.ts` imports it. If `crawl.ts` doesn't import it explicitly, the env vars may be loaded by `tsx` via a `.env` file automatically — confirm this works for `run-queries.ts` too.

```bash
head -5 scripts/crawl.ts
```

If crawl imports env, do the same. If not, remove the env import from `run-queries.ts` and rely on the `.env` file being present.

**Commit if any change needed:**

```bash
git add scripts/run-queries.ts
git commit -m "fix: ensure env vars load correctly in run-queries script"
```
