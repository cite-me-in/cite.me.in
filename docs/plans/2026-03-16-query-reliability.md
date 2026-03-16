# Query Reliability Patch Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Increase query reliability by raising the timeout to 60s, adding 3 retries with exponential backoff, and running queries within each platform in staggered parallel.

**Architecture:** All changes are confined to `queryPlatform.ts`. The `QueryFn` interface already threads `maxRetries` and `timeout` through to Vercel AI SDK's `generateText`, which handles exponential backoff internally. The sequential `for` loop is replaced with a `Promise.all` whose items use `setTimeout` to stagger starts by 1 second each.

**Tech Stack:** TypeScript, Vercel AI SDK (`generateText`), `convert` (for `ms()`), existing `singleQueryRepetition` helper.

---

### Task 1: Update timeout, retries, and parallelise queries

**Files:**
- Modify: `app/lib/llm-visibility/queryPlatform.ts:66-78` (loop → staggered Promise.all)
- Modify: `app/lib/llm-visibility/queryPlatform.ts:122-123` (timeout + maxRetries values)

**Step 1: Open the file and locate the two change sites**

`app/lib/llm-visibility/queryPlatform.ts` — two spots:
1. Lines 66–78: the `for` loop that calls `singleQueryRepetition`
2. Lines 121–123: the `queryFn` call with `maxRetries: 0` and `timeout: ms("10s")`

**Step 2: Replace the sequential loop with staggered Promise.all**

Replace:
```ts
for (let qi = 0; qi < queries.length; qi++) {
  const query = queries[qi];
  await singleQueryRepetition({
    siteId,
    group: query.group,
    modelId,
    platform,
    query: query.query,
    queryFn,
    runId: run.id,
    site,
  });
}
```

With:
```ts
await Promise.all(
  queries.map((query, index) =>
    new Promise<void>((resolve) => setTimeout(resolve, index * 1000)).then(() =>
      singleQueryRepetition({
        siteId,
        group: query.group,
        modelId,
        platform,
        query: query.query,
        queryFn,
        runId: run.id,
        site,
      }),
    ),
  ),
);
```

**Step 3: Update timeout and retries in singleQueryRepetition**

Replace:
```ts
const { citations, extraQueries, text, usage } = await queryFn({
  maxRetries: 0,
  timeout: ms("10s"),
  query,
});
```

With:
```ts
const { citations, extraQueries, text, usage } = await queryFn({
  maxRetries: 3,
  timeout: ms("60s"),
  query,
});
```

**Step 4: Run typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

**Step 5: Commit**

```bash
git add app/lib/llm-visibility/queryPlatform.ts
git commit -m "fix: increase query timeout to 60s, add 3 retries, stagger parallel queries"
```
