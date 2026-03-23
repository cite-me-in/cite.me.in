# Competitor Brand Names & Non-Competitor Filtering

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Show brand names (e.g. "Appear Here") with links to canonical URLs instead of raw domains in the Top Competitors card, and filter out non-competitor reference sites (Wikipedia, Reddit, etc.).

**Architecture:** Add a server-side `getDomainMeta()` utility that fetches each competitor's homepage to extract `og:site_name` or `<title>`, caches results in memory, and falls back to prettified domain on failure. Move competitor computation from the client component to the loader so brand metadata can be fetched server-side. Add a static `NON_COMPETITOR_DOMAINS` blocklist to `topCompetitors()`.

**Tech Stack:** React Router loader, native `fetch` with `AbortSignal.timeout`, in-memory Map cache, existing `topCompetitors()` pure function.

---

## How to Identify Competitors

A citation is a **competitor** if it is not on the `NON_COMPETITOR_DOMAINS` blocklist. The blocklist covers domains that augment AI responses but don't compete as products: UGC/Q&A sites (Reddit, Quora), encyclopedias (Wikipedia), social media (LinkedIn, Twitter, Facebook), video (YouTube), and major news outlets (Bloomberg, Reuters, etc.). Everything else is treated as a competitor.

---

### Task 1: Add non-competitor blocklist to `topCompetitors()`

**Files:**
- Modify: `app/routes/site.$domain_.citations/TopCompetitors.tsx`
- Modify: `test/lib/topCompetitors.test.ts`

**Step 1: Write the failing test**

Add to `test/lib/topCompetitors.test.ts`:

```ts
it("should exclude non-competitor domains (Reddit, Wikipedia, etc.)", () => {
  const queries = [
    {
      citations: [
        "https://reddit.com/r/retail/post",
        "https://en.wikipedia.org/wiki/Retail",
        "https://competitor.com/page",
        "https://youtube.com/watch?v=abc",
        "https://linkedin.com/in/someone",
      ],
    },
  ];
  const { competitors } = topCompetitors(queries, "mysite.com");
  expect(competitors).toHaveLength(1);
  expect(competitors[0].domain).toBe("competitor.com");
});
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/assaf/Projects/cite.me.in
pnpm vitest run test/lib/topCompetitors.test.ts
```

Expected: FAIL — reddit.com and wikipedia.org appear in competitors.

**Step 3: Add blocklist and filter in `TopCompetitors.tsx`**

Add before `export default function TopCompetitors`:

```ts
export const NON_COMPETITOR_DOMAINS = new Set([
  // Community / Q&A
  "reddit.com",
  "quora.com",
  "stackoverflow.com",
  // Encyclopedias
  "wikipedia.org",
  "en.wikipedia.org",
  "wikimedia.org",
  // Social media
  "linkedin.com",
  "twitter.com",
  "x.com",
  "facebook.com",
  "instagram.com",
  "tiktok.com",
  "pinterest.com",
  // Video
  "youtube.com",
  "vimeo.com",
  // News & media
  "nytimes.com",
  "wsj.com",
  "bloomberg.com",
  "reuters.com",
  "ft.com",
  "forbes.com",
  "businessinsider.com",
  "techcrunch.com",
  "theguardian.com",
  "bbc.com",
  "bbc.co.uk",
  "cnn.com",
  // General content platforms
  "medium.com",
  "substack.com",
  "wordpress.com",
]);
```

In `topCompetitors()`, change the counting condition from:
```ts
if (hostname !== ownDomain)
  counts.set(hostname, (counts.get(hostname) ?? 0) + 1);
```
to:
```ts
if (hostname !== ownDomain && !NON_COMPETITOR_DOMAINS.has(hostname))
  counts.set(hostname, (counts.get(hostname) ?? 0) + 1);
```

**Step 4: Run test to verify it passes**

```bash
pnpm vitest run test/lib/topCompetitors.test.ts
```

Expected: All tests PASS.

**Step 5: Commit**

```bash
git add app/routes/site.\$domain_.citations/TopCompetitors.tsx test/lib/topCompetitors.test.ts
git commit -m "feat: filter non-competitor domains from top competitors list"
```

---

### Task 2: Create `app/lib/domainMeta.server.ts`

**Files:**
- Create: `app/lib/domainMeta.server.ts`
- Create: `test/lib/domainMeta.test.ts`

**Step 1: Write the failing tests**

Create `test/lib/domainMeta.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDomainMeta } from "~/lib/domainMeta.server";

describe("getDomainMeta", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should extract og:site_name when present", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        url: "https://www.example-a.com/",
        text: async () =>
          `<html><head><meta property="og:site_name" content="Example Brand" /></head></html>`,
      }),
    );
    const meta = await getDomainMeta("example-a.com");
    expect(meta.brandName).toBe("Example Brand");
    expect(meta.url).toBe("https://www.example-a.com/");
  });

  it("should extract title and strip suffix when og:site_name is absent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        url: "https://example-b.com/",
        text: async () =>
          `<html><head><title>Acme Corp - Home</title></head></html>`,
      }),
    );
    const meta = await getDomainMeta("example-b.com");
    expect(meta.brandName).toBe("Acme Corp");
  });

  it("should fall back to prettified domain on network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error")),
    );
    const meta = await getDomainMeta("example-c.com");
    expect(meta.brandName).toBe("Example-c");
    expect(meta.url).toBe("https://example-c.com");
  });

  it("should prettify hyphenated domains in fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error")),
    );
    const meta = await getDomainMeta("some-brand.io");
    expect(meta.brandName).toBe("Some Brand");
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
pnpm vitest run test/lib/domainMeta.test.ts
```

Expected: FAIL — module not found.

**Step 3: Implement `app/lib/domainMeta.server.ts`**

```ts
type DomainMeta = { brandName: string; url: string };
type CacheEntry = DomainMeta & { fetchedAt: number };

const cache = new Map<string, CacheEntry>();
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function getDomainMeta(domain: string): Promise<DomainMeta> {
  const cached = cache.get(domain);
  if (cached && Date.now() - cached.fetchedAt < TTL_MS)
    return { brandName: cached.brandName, url: cached.url };

  try {
    const res = await fetch(`https://${domain}`, {
      signal: AbortSignal.timeout(3000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; cite.me.in/1.0)" },
    });
    const canonicalUrl = res.url;
    const html = await res.text();
    const brandName = extractBrandName(html) ?? prettifyDomain(domain);
    const meta = { brandName, url: canonicalUrl };
    cache.set(domain, { ...meta, fetchedAt: Date.now() });
    return meta;
  } catch {
    const meta = { brandName: prettifyDomain(domain), url: `https://${domain}` };
    cache.set(domain, { ...meta, fetchedAt: Date.now() });
    return meta;
  }
}

function extractBrandName(html: string): string | null {
  const ogMatch =
    html.match(
      /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i,
    ) ??
    html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i,
    );
  if (ogMatch) return ogMatch[1].trim();

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    const trimmed = titleMatch[1]
      .trim()
      .replace(/\s*[-|—]\s*.+$/, "")
      .trim();
    return trimmed || null;
  }
  return null;
}

function prettifyDomain(domain: string): string {
  const name = domain.replace(/\.[^.]+$/, "");
  return name
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
```

**Step 4: Run tests to verify they pass**

```bash
pnpm vitest run test/lib/domainMeta.test.ts
```

Expected: All tests PASS.

**Step 5: Commit**

```bash
git add app/lib/domainMeta.server.ts test/lib/domainMeta.test.ts
git commit -m "feat: add domain metadata fetcher for brand names and canonical URLs"
```

---

### Task 3: Move competitor computation to loader and enrich with brand metadata

**Files:**
- Modify: `app/routes/site.$domain_.citations/route.tsx`

**Step 1: Update the loader**

Import `getDomainMeta` and `topCompetitors` at the top:

```ts
import { getDomainMeta } from "~/lib/domainMeta.server";
import { topCompetitors } from "./TopCompetitors";
```

Add `PLATFORMS[0].name` reference — `PLATFORMS` is already defined in the file.

In the `loader` function, after the DB queries, add:

```ts
const url = new URL(request.url);
const platform = url.searchParams.get("platform") ?? PLATFORMS[0].name;

const recentRuns = runs.filter((r) => r.platform === platform);
const queriesForCompetitors = siteQueries
  .map((sq) => {
    for (const r of recentRuns) {
      const found = r.queries.find((q) => q.query === sq.query);
      if (found) return found;
    }
    return null;
  })
  .filter((q) => q !== null);

const { competitors: rawCompetitors } = topCompetitors(
  queriesForCompetitors,
  site.domain,
);
const competitors = await Promise.all(
  rawCompetitors.map(async (c) => ({ ...c, ...(await getDomainMeta(c.domain)) })),
);
```

Change the return statement to include `competitors`:

```ts
return { site, runs, siteQueries, competitors };
```

**Step 2: Run typecheck**

```bash
pnpm test:typecheck
```

Fix any type errors before continuing.

**Step 3: Commit**

```bash
git add app/routes/site.\$domain_.citations/route.tsx
git commit -m "refactor: compute top competitors in loader with brand metadata"
```

---

### Task 4: Update `TopCompetitors` component to display brand name + link

**Files:**
- Modify: `app/routes/site.$domain_.citations/TopCompetitors.tsx`
- Modify: `app/routes/site.$domain_.citations/route.tsx` (remove old prop passing)

**Step 1: Update `TopCompetitors` component props**

Change the component signature from:
```ts
export default function TopCompetitors({
  queries,
  ownDomain,
}: {
  queries: { citations: string[] }[];
  ownDomain: string;
})
```
to:
```ts
export default function TopCompetitors({
  competitors,
}: {
  competitors: { domain: string; brandName: string; url: string; count: number; pct: number }[];
})
```

Remove the `const { competitors } = topCompetitors(queries, ownDomain);` line at the top of the component.

Update the render to use `brandName` and `url`:
- Link `to`: change `externalLink(\`https://${domain}\`)` → `externalLink(c.url)`
- Link text: change `{domain}` → `{c.brandName}`

The map becomes:
```tsx
{competitors.map(({ domain, brandName, url, count, pct }) => (
  <div
    key={domain}
    className="flex items-center justify-between gap-4"
  >
    <Link
      className="truncate font-medium"
      to={externalLink(url)}
      target="_blank"
    >
      {brandName}
    </Link>
    <div className="flex shrink-0 items-center gap-2">
      <span className="text-foreground/60">
        {count.toLocaleString()}{" "}
        {count === 1 ? "citation" : "citations"}
      </span>
      <Badge variant="neutral">{pct}%</Badge>
    </div>
  </div>
))}
```

**Step 2: Update `route.tsx` to pass `competitors` from loaderData**

In `SiteCitationsPage`, change:
```tsx
<TopCompetitors queries={mergedQueries} ownDomain={site.domain} />
```
to:
```tsx
<TopCompetitors competitors={competitors} />
```

**Step 3: Run typecheck**

```bash
pnpm test:typecheck
```

**Step 4: Commit**

```bash
git add app/routes/site.\$domain_.citations/TopCompetitors.tsx app/routes/site.\$domain_.citations/route.tsx
git commit -m "feat: show brand names and links in top competitors card"
```

---

### Task 5: Reset visual baseline and verify

**Files:**
- Delete: `__screenshots__/site.citations.png`
- Delete: `__screenshots__/site.citations.html`

**Step 1: Delete stale baselines**

```bash
rm /Users/assaf/Projects/cite.me.in/__screenshots__/site.citations.png
rm /Users/assaf/Projects/cite.me.in/__screenshots__/site.citations.html
```

**Step 2: Run the citations test suite**

```bash
pnpm vitest run test/lib/topCompetitors.test.ts test/lib/domainMeta.test.ts
```

Expected: All PASS.

**Step 3: Run the Playwright visual test (regenerates baseline)**

```bash
cd /Users/assaf/Projects/cite.me.in && pnpm exec playwright test test/routes/site.citations.test.ts
```

Expected: Visual tests PASS (baseline is regenerated on first run when missing).

**Step 4: Commit baselines**

```bash
git add __screenshots__/site.citations.png __screenshots__/site.citations.html
git commit -m "test: update visual baselines for citations page with brand names"
```

---

## Notes

- The in-memory cache in `domainMeta.server.ts` resets on server restart — TTL is 7 days. This is intentional: brand names rarely change, and a cold restart gives fresh data.
- In tests, the fixture domains (`popupinsider.com`, `storeshq.com`, etc.) don't resolve. Fetch will fail/timeout and the fallback prettified name will be used. The visual baseline will reflect these fallback names.
- `AbortSignal.timeout(3000)` means each competitor fetch times out after 3 seconds. With 5 competitors in parallel (`Promise.all`), the worst-case loader overhead is ~3 seconds on a cold cache. Subsequent requests hit the cache instantly.
- `topCompetitors()` remains a pure exported function — the loader calls it, as does the existing unit test.
