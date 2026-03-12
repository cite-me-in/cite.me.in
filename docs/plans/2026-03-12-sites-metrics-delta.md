# Sites Metrics Delta Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Show how Citations and Score changed compared to the previous citation run on the /sites page (e.g. "20 +100% 10").

**Architecture:** `loadSitesWithMetrics` fetches the two most recent `CitationQueryRun` records per site (ordered DESC, take 2) and returns previous-period values alongside current ones. `SiteEntry` renders a delta badge between the current and previous values.

**Tech Stack:** Prisma (query change), TypeScript (return type), React (SiteEntry UI), Playwright (integration test)

---

### Task 1: Update `loadSitesWithMetrics` to return previous-run metrics

**Files:**
- Modify: `app/lib/sites.server.ts`

**Step 1: Change the `citationRuns` include**

Remove the date filter from `citationRuns` and add ordering + limit so we always get the two most recent runs. Keep the date filter on `botVisits` unchanged.

Replace:
```ts
citationRuns: {
  include: {
    queries: {
      select: { citations: true },
    },
  },
  where: { createdAt: { gte } },
},
```

With:
```ts
citationRuns: {
  include: {
    queries: {
      select: { citations: true },
    },
  },
  orderBy: { createdAt: "desc" },
  take: 2,
},
```

**Step 2: Update the return type**

Change the return type of `loadSitesWithMetrics` to include:
```ts
previousCitationsToDomain: number | null;
previousScore: number | null;
```

**Step 3: Update the `.map()` to compute both current and previous metrics**

Replace:
```ts
return sites.map((site) => {
  const { citationsToDomain, score, totalCitations } =
    calculateCitationMetrics({
      domain: site.domain,
      queries: site.citationRuns[0]?.queries ?? [],
    });

  return {
    citationsToDomain,
    score,
    site,
    totalBotVisits: sumBy(site.botVisits, (v) => v.count),
    totalCitations,
    uniqueBots: uniqBy(site.botVisits, (v) => v.botType).length,
  };
});
```

With:
```ts
return sites.map((site) => {
  const current = calculateCitationMetrics({
    domain: site.domain,
    queries: site.citationRuns[0]?.queries ?? [],
  });
  const previous = site.citationRuns[1]
    ? calculateCitationMetrics({
        domain: site.domain,
        queries: site.citationRuns[1].queries,
      })
    : null;

  return {
    citationsToDomain: current.citationsToDomain,
    previousCitationsToDomain: previous?.citationsToDomain ?? null,
    previousScore: previous?.score ?? null,
    score: current.score,
    site,
    totalBotVisits: sumBy(site.botVisits, (v) => v.count),
    totalCitations: current.totalCitations,
    uniqueBots: uniqBy(site.botVisits, (v) => v.botType).length,
  };
});
```

**Step 4: Verify TypeScript compiles**

Run: `pnpm typecheck`
Expected: no errors

**Step 5: Commit**

```bash
git add app/lib/sites.server.ts
git commit -m "feat: return previous-run citation metrics from loadSitesWithMetrics"
```

---

### Task 2: Add delta display to `SiteEntry`

**Files:**
- Modify: `app/routes/sites/SiteEntry.tsx`
- Modify: `app/routes/sites/route.tsx`

**Step 1: Add props to `SiteEntry`**

Add `previousCitationsToDomain: number | null` and `previousScore: number | null` to the props destructure and type annotation.

**Step 2: Add a `Delta` helper component inside the file (above `SiteEntry`)**

```tsx
function Delta({ current, previous }: { current: number; previous: number | null }) {
  if (previous === null) return null;
  if (previous === 0 && current === 0) return null;
  if (previous === 0)
    return <span className="text-sm font-medium text-green-700">new</span>;

  const pct = Math.round(((current - previous) / previous) * 100);
  const positive = pct >= 0;
  return (
    <span className={`text-sm font-medium ${positive ? "text-green-700" : "text-red-600"}`}>
      {positive ? "+" : ""}{pct}%
    </span>
  );
}
```

**Step 3: Update the Citations and Score cells to show current, delta, previous**

Replace the Citations `<div>`:
```tsx
<div>
  <p className="font-light">Citations</p>
  <p className="font-bold text-3xl">
    {citationsToDmain.toLocaleString()}
  </p>
</div>
```

With:
```tsx
<div>
  <p className="font-light">Citations</p>
  <p className="font-bold text-3xl">{citationsToDmain.toLocaleString()}</p>
  <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
    <Delta current={citationsToDmain} previous={previousCitationsToDomain} />
    {previousCitationsToDomain !== null && (
      <span>{previousCitationsToDomain.toLocaleString()}</span>
    )}
  </div>
</div>
```

Replace the Score `<div>`:
```tsx
<div>
  <p className="font-light">Score</p>
  <p className="font-bold text-3xl">
    {score.toFixed(1).toLocaleString()}
  </p>
</div>
```

With:
```tsx
<div>
  <p className="font-light">Score</p>
  <p className="font-bold text-3xl">{score.toFixed(1)}</p>
  <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
    <Delta current={score} previous={previousScore} />
    {previousScore !== null && (
      <span>{previousScore.toFixed(1)}</span>
    )}
  </div>
</div>
```

**Step 4: Pass the new props in `route.tsx`**

In the `<SiteEntry ... />` JSX in `app/routes/sites/route.tsx`, add:
```tsx
previousCitationsToDomain={item.previousCitationsToDomain}
previousScore={item.previousScore}
```

**Step 5: Verify TypeScript compiles**

Run: `pnpm typecheck`
Expected: no errors

**Step 6: Commit**

```bash
git add app/routes/sites/SiteEntry.tsx app/routes/sites/route.tsx
git commit -m "feat: show citations and score delta vs previous run on sites page"
```

---

### Task 3: Add integration test for delta display and refresh visual baseline

**Files:**
- Modify: `test/routes/sites.test.ts`
- Delete: `__screenshots__/sites.list.png` and `__screenshots__/sites.list.html`

**Step 1: Add a `"with two citation runs"` describe block**

Add this after the `"when site available"` describe block (around line 194), before the outer `afterAll`. Use fixed IDs to avoid conflicts:

```ts
describe("with two citation runs", () => {
  const siteId = "site-delta-test";

  beforeAll(async () => {
    await prisma.site.create({
      data: {
        id: siteId,
        domain: "delta-test.com",
        accountId: user.accountId,
      },
    });
    // Previous run: 10 citations to domain
    await prisma.citationQueryRun.create({
      data: {
        siteId,
        platform: "chatgpt",
        model: "gpt-4o",
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        queries: {
          createMany: {
            data: [
              { query: "test query", citations: ["https://delta-test.com/a", "https://delta-test.com/b", "https://delta-test.com/c", "https://delta-test.com/d", "https://delta-test.com/e", "https://delta-test.com/f", "https://delta-test.com/g", "https://delta-test.com/h", "https://delta-test.com/i", "https://delta-test.com/j"], text: "response", group: "group", position: 0, extraQueries: [] },
            ],
          },
        },
      },
    });
    // Current run: 20 citations to domain
    await prisma.citationQueryRun.create({
      data: {
        siteId,
        platform: "chatgpt",
        model: "gpt-4o",
        createdAt: new Date(),
        queries: {
          createMany: {
            data: [
              {
                query: "test query",
                citations: [
                  "https://delta-test.com/a", "https://delta-test.com/b",
                  "https://delta-test.com/c", "https://delta-test.com/d",
                  "https://delta-test.com/e", "https://delta-test.com/f",
                  "https://delta-test.com/g", "https://delta-test.com/h",
                  "https://delta-test.com/i", "https://delta-test.com/j",
                  "https://delta-test.com/k", "https://delta-test.com/l",
                  "https://delta-test.com/m", "https://delta-test.com/n",
                  "https://delta-test.com/o", "https://delta-test.com/p",
                  "https://delta-test.com/q", "https://delta-test.com/r",
                  "https://delta-test.com/s", "https://delta-test.com/t",
                ],
                text: "response",
                group: "group",
                position: 0,
                extraQueries: [],
              },
            ],
          },
        },
      },
    });
    page = await goto("/sites");
  });

  it("shows +100% delta for citations", async () => {
    const siteRow = page.locator("div").filter({ hasText: "delta-test.com" }).first();
    await expect(siteRow.getByText("+100%")).toBeVisible();
  });

  it("shows previous citation count", async () => {
    const siteRow = page.locator("div").filter({ hasText: "delta-test.com" }).first();
    await expect(siteRow.getByText("10")).toBeVisible();
  });

  afterAll(async () => {
    await prisma.site.delete({ where: { id: siteId } });
  });
});
```

**Step 2: Delete stale visual baselines**

```bash
rm -f __screenshots__/sites.list.png __screenshots__/sites.list.html
```

**Step 3: Run the new test to verify it passes**

```bash
pnpm playwright test test/routes/sites.test.ts --grep "delta"
```

Expected: PASS (baseline created on first run; delta assertions pass)

**Step 4: Commit**

```bash
git add test/routes/sites.test.ts
git commit -m "test: add integration test for citations delta display on sites page"
```
