# Google AIO Citation Tracking Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Track which URLs Google cites in AI Overview blocks for each site's tracked queries, storing results in new `SerpRun`/`SerpQuery` models, running daily via the existing cron.

**Architecture:** Mirror the existing `CitationQueryRun`/`CitationQuery` pattern — one `SerpRun` per site/source/date, one `SerpQuery` per query. DataForSEO's SERP API returns AI Overview citations inline with organic results. A new server-side runner loops over `SiteQuery` rows and calls DataForSEO once per query.

**Tech Stack:** DataForSEO SERP API (HTTP Basic auth, native fetch), Prisma, Vitest (unit tests with vi.mock for fetch), existing cron infrastructure.

---

### Task 1: Schema changes

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add `SerpRun` and `SerpQuery` models, remove `position` from `CitationQuery`**

In `prisma/schema.prisma`:

1. Remove `position` field from `CitationQuery`:
```prisma
// Remove this line:
position     Int?             @map("position")
```

2. Add `serpRuns` relation to `Site` (after `siteUsers`):
```prisma
serpRuns             SerpRun[]
```

3. Add at the end of the file (before the enums):
```prisma
model SerpRun {
  id        String      @id @default(cuid())
  onDate    String      @map("on_date")
  queries   SerpQuery[]
  site      Site        @relation(fields: [siteId], references: [id], onDelete: Cascade)
  siteId    String      @map("site_id")
  source    String      @map("source")
  updatedAt DateTime    @map("updated_at") @updatedAt

  @@unique([siteId, source, onDate])
  @@index([siteId])
  @@map("serp_runs")
}

model SerpQuery {
  aioPresent Boolean  @map("aio_present")
  citations  String[] @map("citations")
  createdAt  DateTime @map("created_at") @default(now())
  group      String   @map("group")
  id         String   @id @default(cuid())
  query      String   @map("query")
  run        SerpRun  @relation(fields: [runId], references: [id], onDelete: Cascade)
  runId      String   @map("run_id")

  @@index([runId])
  @@map("serp_queries")
}
```

**Step 2: Push schema and regenerate client**

```bash
pnpm prisma db push && pnpm prisma generate
```

Expected: migrations applied, no errors.

**Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add SerpRun/SerpQuery models, remove unused CitationQuery.position"
```

---

### Task 2: Add env vars

**Files:**
- Modify: `app/lib/envVars.server.ts`

**Step 1: Add the two new vars**

After `CRON_SECRET`, add:
```ts
DATAFORSEO_LOGIN: env.get("DATAFORSEO_LOGIN").required(false).asString(),
DATAFORSEO_PASSWORD: env.get("DATAFORSEO_PASSWORD").required(false).asString(),
```

Both are `required(false)` — the runner will skip gracefully when credentials are absent (same pattern as `OPENAI_API_KEY`).

**Step 2: Commit**

```bash
git add app/lib/envVars.server.ts
git commit -m "feat: add DATAFORSEO_LOGIN/PASSWORD env vars"
```

---

### Task 3: DataForSEO client + test

**Files:**
- Create: `app/lib/serp/dataForSeo.server.ts`
- Create: `test/lib/serp/dataForSeo.test.ts`

**Step 1: Write the failing test**

Create `test/lib/serp/dataForSeo.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import fetchAioResults from "~/lib/serp/dataForSeo.server";

vi.mock("~/lib/envVars.server", () => ({
  default: {
    DATAFORSEO_LOGIN: "test@example.com",
    DATAFORSEO_PASSWORD: "test-password",
  },
}));

const makeResponse = (items: unknown[]) =>
  ({
    ok: true,
    json: async () => ({
      tasks: [{ result: [{ items }] }],
    }),
  }) as Response;

describe("fetchAioResults", () => {
  it("should return aioPresent=true and citations when AIO block exists", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      makeResponse([
        {
          type: "ai_overview",
          references: [
            { url: "https://example.com/page" },
            { url: "https://other.com/" },
          ],
        },
        { type: "organic", url: "https://example.com" },
      ]),
    );

    const result = await fetchAioResults("best retail space platforms");

    expect(result).toEqual({
      aioPresent: true,
      citations: ["https://example.com/page", "https://other.com/"],
    });
  });

  it("should return aioPresent=false and empty citations when no AIO block", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      makeResponse([
        { type: "organic", url: "https://example.com" },
      ]),
    );

    const result = await fetchAioResults("niche query with no AIO");

    expect(result).toEqual({ aioPresent: false, citations: [] });
  });

  it("should return aioPresent=true and empty citations when AIO has no references", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      makeResponse([{ type: "ai_overview", references: [] }]),
    );

    const result = await fetchAioResults("query");

    expect(result).toEqual({ aioPresent: true, citations: [] });
  });

  it("should throw when the API response is not ok", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    } as Response);

    await expect(fetchAioResults("query")).rejects.toThrow("DataForSEO error 401");
  });
});
```

**Step 2: Run to verify it fails**

```bash
pnpm vitest run test/lib/serp/dataForSeo.test.ts
```

Expected: FAIL — module not found.

**Step 3: Implement the client**

Create `app/lib/serp/dataForSeo.server.ts`:

```ts
import envVars from "~/lib/envVars.server";

const ENDPOINT =
  "https://api.dataforseo.com/v3/serp/google/organic/live/advanced";

export default async function fetchAioResults(
  keyword: string,
): Promise<{ aioPresent: boolean; citations: string[] }> {
  const credentials = btoa(
    `${envVars.DATAFORSEO_LOGIN}:${envVars.DATAFORSEO_PASSWORD}`,
  );

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      { keyword, location_code: 2840, language_code: "en", depth: 10 },
    ]),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`DataForSEO error ${response.status}: ${text}`);
  }

  const json = await response.json();
  const items: { type: string; references?: { url: string }[] }[] =
    json.tasks?.[0]?.result?.[0]?.items ?? [];

  const aio = items.find((item) => item.type === "ai_overview");
  if (!aio) return { aioPresent: false, citations: [] };

  return {
    aioPresent: true,
    citations: (aio.references ?? []).map((r) => r.url),
  };
}
```

**Step 4: Run to verify it passes**

```bash
pnpm vitest run test/lib/serp/dataForSeo.test.ts
```

Expected: all 4 tests PASS.

**Step 5: Commit**

```bash
git add app/lib/serp/dataForSeo.server.ts test/lib/serp/dataForSeo.test.ts
git commit -m "feat: add DataForSEO SERP client with AIO citation parsing"
```

---

### Task 4: queryGoogleAio runner + test

**Files:**
- Create: `app/lib/serp/queryGoogleAio.server.ts`
- Create: `test/lib/serp/queryGoogleAio.test.ts`

**Step 1: Write the failing test**

Create `test/lib/serp/queryGoogleAio.test.ts`:

```ts
import { beforeAll, describe, expect, it, vi } from "vitest";
import fetchAioResults from "~/lib/serp/dataForSeo.server";
import queryGoogleAio from "~/lib/serp/queryGoogleAio.server";
import prisma from "~/lib/prisma.server";

vi.mock("@sentry/node", () => ({ captureException: vi.fn() }));
vi.mock("~/lib/serp/dataForSeo.server");

const QUERIES = [
  { query: "best temporary retail space platform", group: "1. discovery" },
  { query: "short-term retail lease options", group: "2. active_search" },
];

describe("queryGoogleAio", () => {
  let site: { id: string; domain: string };

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { id: "user-aio-1", email: "aio@test.com", passwordHash: "test" },
    });
    site = await prisma.site.create({
      data: {
        apiKey: "test-api-key-aio-1",
        content: "Test content",
        domain: "rentail.space",
        id: "site-aio-1",
        ownerId: user.id,
        summary: "Test summary",
      },
    });
    for (const q of QUERIES) {
      await prisma.siteQuery.create({
        data: { siteId: site.id, query: q.query, group: q.group },
      });
    }
  });

  it("should create a SerpRun and SerpQuery rows for each query", async () => {
    vi.mocked(fetchAioResults)
      .mockResolvedValueOnce({
        aioPresent: true,
        citations: ["https://rentail.space/listings", "https://other.com"],
      })
      .mockResolvedValueOnce({
        aioPresent: false,
        citations: [],
      });

    await queryGoogleAio(site);

    const run = await prisma.serpRun.findFirst({
      where: { siteId: site.id, source: "google-aio" },
      include: { queries: { orderBy: { query: "asc" } } },
    });

    expect(run).not.toBeNull();
    expect(run!.queries).toHaveLength(2);

    const [q1, q2] = run!.queries;
    expect(q1.aioPresent).toBe(true);
    expect(q1.citations).toEqual(["https://rentail.space/listings", "https://other.com"]);

    expect(q2.aioPresent).toBe(false);
    expect(q2.citations).toEqual([]);
  });

  it("should not create duplicate SerpQuery rows when run twice on the same day", async () => {
    vi.mocked(fetchAioResults).mockResolvedValue({
      aioPresent: true,
      citations: ["https://rentail.space"],
    });

    await queryGoogleAio(site);

    const runs = await prisma.serpRun.findMany({
      where: { siteId: site.id, source: "google-aio" },
      include: { queries: true },
    });

    expect(runs).toHaveLength(1);
    expect(runs[0].queries).toHaveLength(2);
  });
});
```

**Step 2: Run to verify it fails**

```bash
pnpm vitest run test/lib/serp/queryGoogleAio.test.ts
```

Expected: FAIL — module not found.

**Step 3: Implement the runner**

Create `app/lib/serp/queryGoogleAio.server.ts`:

```ts
import debug from "debug";
import captureAndLogError from "~/lib/captureAndLogError.server";
import envVars from "~/lib/envVars.server";
import prisma from "~/lib/prisma.server";
import fetchAioResults from "./dataForSeo.server";

const logger = debug("server");

export default async function queryGoogleAio(site: {
  id: string;
  domain: string;
}): Promise<void> {
  if (!envVars.DATAFORSEO_LOGIN || !envVars.DATAFORSEO_PASSWORD) {
    logger("[%s:google-aio] Skipping — DATAFORSEO credentials not set", site.id);
    return;
  }

  try {
    const onDate = new Date().toISOString().split("T")[0];
    const run = await prisma.serpRun.upsert({
      where: { siteId_source_onDate: { siteId: site.id, source: "google-aio", onDate } },
      update: {},
      create: { siteId: site.id, source: "google-aio", onDate },
    });

    const siteQueries = await prisma.siteQuery.findMany({
      where: { siteId: site.id },
      orderBy: [{ group: "asc" }, { query: "asc" }],
    });

    for (const siteQuery of siteQueries) {
      const existing = await prisma.serpQuery.findFirst({
        where: { runId: run.id, query: siteQuery.query },
      });
      if (existing) {
        logger("[%s:google-aio] %s — already exists", site.id, siteQuery.query);
        continue;
      }

      try {
        const { aioPresent, citations } = await fetchAioResults(siteQuery.query);
        await prisma.serpQuery.create({
          data: {
            runId: run.id,
            query: siteQuery.query,
            group: siteQuery.group,
            aioPresent,
            citations,
          },
        });
        logger("[%s:google-aio] %s — aioPresent=%s citations=%d", site.id, siteQuery.query, aioPresent, citations.length);
      } catch (error) {
        captureAndLogError(error, { extra: { siteId: site.id, query: siteQuery.query } });
      }
    }
  } catch (error) {
    captureAndLogError(error, { extra: { siteId: site.id, step: "google-aio" } });
  }
}
```

**Step 4: Run to verify it passes**

```bash
pnpm vitest run test/lib/serp/queryGoogleAio.test.ts
```

Expected: all tests PASS.

**Step 5: Commit**

```bash
git add app/lib/serp/queryGoogleAio.server.ts test/lib/serp/queryGoogleAio.test.ts
git commit -m "feat: add queryGoogleAio runner"
```

---

### Task 5: Wire into cron

**Files:**
- Modify: `app/routes/cron.process-sites.ts`

**Step 1: Import and call `queryGoogleAio`**

Add import at the top of `cron.process-sites.ts` (after the existing imports):
```ts
import queryGoogleAio from "~/lib/serp/queryGoogleAio.server";
```

In `nextCitationRun`, the existing `Promise.all` call is:
```ts
await Promise.all([nextCitationRun(site), updateBotInsight(site)]);
```

Change to:
```ts
await Promise.all([nextCitationRun(site), updateBotInsight(site), queryGoogleAio(site)]);
```

**Step 2: Run typecheck**

```bash
pnpm check:type
```

Expected: no errors.

**Step 3: Commit**

```bash
git add app/routes/cron.process-sites.ts
git commit -m "feat: run Google AIO tracking in daily cron"
```
