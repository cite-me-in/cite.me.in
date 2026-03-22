# Smart Site Scraper Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:executing-plans to implement this plan task-by-task.

**Goal:** Replace the single-file site crawler in `sites.server.ts` with a smart, multi-format `app/lib/scrape/` module that discovers content via llms.txt/sitemap/RSS/nav, extracts Markdown/JSON-LD/HTML intelligently, and stops early on word/page/time limits using a bounded-concurrency queue.

**Architecture:** A bounded-concurrency-3 queue in `crawl.ts` drives the crawl; URL discovery in `discover.ts` runs parallel probes (llms.txt, robots.txt, sitemap, RSS, nav) and returns a priority-ordered list; `extract.ts` picks the best extraction strategy per page (Markdown passthrough → JSON-LD → HTML semantic elements → fallback). `index.ts` is the public API.

**Tech Stack:** TypeScript, native `fetch` with `AbortSignal`, existing `~/lib/html/parseHTML` helpers, Vitest with `vi.stubGlobal` mocks, static HTML fixture files.

**Design doc:** `docs/plans/2026-03-21-scraper-design.md`

---

### Task 1: Module skeleton — create files and migrate import

**Files:**
- Create: `app/lib/scrape/index.ts`
- Create: `app/lib/scrape/extract.ts`
- Create: `app/lib/scrape/discover.ts`
- Create: `app/lib/scrape/crawl.ts`
- Modify: `app/lib/sites.server.ts` — remove old crawler code, import from `~/lib/scrape`
- Modify: `test/lib/sites.server.test.ts` — update import path

**Step 1: Create `app/lib/scrape/crawl.ts`**

Move the entire existing crawler out of `sites.server.ts` verbatim (no logic changes yet). This keeps tests green while we restructure.

```ts
// app/lib/scrape/crawl.ts
import { ms } from "convert";
import debug from "debug";
import { getElementsByTagName, getMainContent, htmlToMarkdown } from "~/lib/html/parseHTML";
import parseHTMLTree from "~/lib/html/parseHTML";

const MEDIA_EXTENSIONS = /\.(pdf|jpg|jpeg|png|gif|svg|webp|mp4|mp3|zip|exe)$/i;
const logger = debug("fetch");

// Paste the full bodies of crawlSiteCustom, discoverUrls, fetchSitemapUrls, extractNavUrls here unchanged.
// We will replace them piece by piece in later tasks.

export async function crawl({
  domain,
  maxWords,
  maxPages,
  maxSeconds,
}: {
  domain: string;
  maxWords: number;
  maxPages: number;
  maxSeconds: number;
}): Promise<string> {
  // delegate to the migrated crawlSiteCustom for now
  return crawlSiteCustom({ domain, maxPages, maxWords, maxSeconds });
}
```

**Step 2: Create `app/lib/scrape/extract.ts`** (stub — real logic in Task 3/4)

```ts
// app/lib/scrape/extract.ts
export type ExtractionResult = {
  title: string;
  text: string;
};

// stub — replaced in Task 3
export async function fetchAndExtract(
  _url: string,
  _signal: AbortSignal,
): Promise<ExtractionResult | null> {
  return null;
}
```

**Step 3: Create `app/lib/scrape/discover.ts`** (stub — real logic in Task 5/6)

```ts
// app/lib/scrape/discover.ts
export type DiscoveryResult = {
  urls: string[];
  disallowedPaths: Set<string>;
};

// stub — replaced in Task 5
export async function discoverUrls(_params: {
  domain: string;
  homepageHtml: string;
  signal: AbortSignal;
}): Promise<DiscoveryResult> {
  return { urls: [], disallowedPaths: new Set() };
}
```

**Step 4: Create `app/lib/scrape/index.ts`**

```ts
// app/lib/scrape/index.ts
import { crawl } from "./crawl";

export async function fetchSiteContent({
  domain,
  maxWords = 5_000,
  maxPages = 20,
  maxSeconds = 10,
}: {
  domain: string;
  maxWords?: number;
  maxPages?: number;
  maxSeconds?: number;
}): Promise<string> {
  try {
    return await crawl({ domain, maxWords, maxPages, maxSeconds });
  } catch (error) {
    if (error instanceof Response) throw error;
    throw new Error(`I couldn't fetch the main page of ${domain}`);
  }
}
```

**Step 5: Update `app/lib/sites.server.ts`**

Remove: `MEDIA_EXTENSIONS`, `CRAWL_BUDGET_MS`, `crawlSiteCustom`, `discoverUrls`, `fetchSitemapUrls`, `extractNavUrls`, and the `parseHTMLTree`/`getElementsByTagName`/`getMainContent`/`htmlToMarkdown` imports.

Update the `fetchSiteContent` function to re-export from `~/lib/scrape`:
```ts
export { fetchSiteContent } from "~/lib/scrape";
```

Or replace the call in `addSiteToUser`:
```ts
import { fetchSiteContent } from "~/lib/scrape";
```

**Step 6: Update test import**

In `test/lib/sites.server.test.ts`, the import `from "~/lib/sites.server"` still works since we re-export. No change needed — verify by running tests.

**Step 7: Run existing tests**

```bash
pnpm vitest run test/lib/sites.server.test.ts
```
Expected: all tests pass (green).

**Step 8: Commit**

```bash
git add app/lib/scrape/ app/lib/sites.server.ts test/lib/sites.server.test.ts
git commit -m "refactor: move site crawler into app/lib/scrape module"
```

---

### Task 2: Test fixtures and mock fetch helper

**Files:**
- Create: `test/lib/scrape/fixtures.ts` — fixture HTML map + mock fetch factory
- Create: `test/lib/scrape/extract.test.ts` (empty shell)
- Create: `test/lib/scrape/discover.test.ts` (empty shell)
- Create: `test/lib/scrape/crawl.test.ts` (empty shell)

**Step 1: Create `test/lib/scrape/fixtures.ts`**

```ts
// test/lib/scrape/fixtures.ts
// Static HTML fixtures for testing the scraper.
// Each fixture simulates one specific site shape.

export type MockResponse = {
  ok: boolean;
  status?: number;
  headers: { get: (name: string) => string | null };
  text: () => Promise<string>;
};

export type FixtureMap = Record<string, MockResponse>;

function html(body: string, contentType = "text/html"): MockResponse {
  return {
    ok: true,
    status: 200,
    headers: { get: (name) => (name === "content-type" ? contentType : null) },
    text: async () => body,
  };
}

function notFound(): MockResponse {
  return {
    ok: false,
    status: 404,
    headers: { get: () => null },
    text: async () => "",
  };
}

function markdown(body: string): MockResponse {
  return html(body, "text/markdown");
}

// A homepage that links to /llms.txt, /sitemap.txt, RSS feed
export const HOMEPAGE_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>Acme Corp</title>
  <link rel="sitemap" href="/sitemap.txt" />
  <link rel="alternate" type="application/rss+xml" href="/feed.xml" />
</head>
<body>
  <nav>
    <a href="/about">About</a>
    <a href="/pricing">Pricing</a>
  </nav>
  <main>
    <h1>Welcome to Acme</h1>
    <p>We make great software products for businesses.</p>
  </main>
</body>
</html>`;

export const LLMS_TXT = `# Acme Corp LLM Context
https://acme.com/about
https://acme.com/pricing
https://acme.com/blog/post-1
`;

export const ROBOTS_TXT = `User-agent: *
Disallow: /admin/
Disallow: /private/
`;

export const SITEMAP_TXT = `https://acme.com/about
https://acme.com/pricing
https://acme.com/blog
`;

export const SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://acme.com/about</loc></url>
  <url><loc>https://acme.com/pricing</loc></url>
</urlset>`;

export const RSS_FEED = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Acme Blog</title>
    <item><title>Post 1</title><link>https://acme.com/blog/post-1</link></item>
    <item><title>Post 2</title><link>https://acme.com/blog/post-2</link></item>
  </channel>
</rss>`;

export const JSON_LD_HTML = `<!DOCTYPE html>
<html><head><title>Article Page</title>
<script type="application/ld+json">
{"@type":"Article","headline":"How to do things","articleBody":"This is the main article content extracted from JSON-LD. It has enough words."}
</script>
</head><body><div>Some noisy sidebar content that should be ignored.</div></body></html>`;

export const CANONICAL_SKIP_HTML = `<!DOCTYPE html>
<html><head>
  <title>Duplicate</title>
  <link rel="canonical" href="https://acme.com/original" />
</head><body><main>Duplicate content here</main></body></html>`;

export const MARKDOWN_RESPONSE = `# About Acme

We build great things.

## Our Mission

To serve customers well.
`;

export const HTML_MAIN_CONTENT = `<!DOCTYPE html>
<html><head><title>Product Page</title></head>
<body>
  <header>Nav stuff that should be ignored</header>
  <main>
    <h1>Our Product</h1>
    <p>This is the main content of the page about our product features.</p>
  </main>
  <footer>Footer stuff that should be ignored</footer>
</body></html>`;

export const HTML_ARTICLE_CONTENT = `<!DOCTYPE html>
<html><head><title>Blog Post</title></head>
<body>
  <nav>Navigation ignored</nav>
  <article>
    <h1>Blog Post Title</h1>
    <p>This is the article content that should be extracted.</p>
  </article>
</body></html>`;

export const HTML_ROLE_MAIN = `<!DOCTYPE html>
<html><head><title>App Page</title></head>
<body>
  <div role="main">
    <h1>App Content</h1>
    <p>Content inside role=main should be extracted.</p>
  </div>
</body></html>`;

export const HTML_ID_ROOT = `<!DOCTYPE html>
<html><head><title>React App</title></head>
<body>
  <div id="root">
    <h1>React Content</h1>
    <p>Content inside #root should be extracted as fallback.</p>
  </div>
</body></html>`;

// Factory: creates a vi-compatible mock fetch from a URL→response map
export function mockFetch(responses: FixtureMap) {
  return async (url: string | URL, _init?: RequestInit): Promise<MockResponse> => {
    const key = url.toString();
    return responses[key] ?? notFound();
  };
}

// Pre-built fixture: site with llms.txt
export function llmsTxtSite(): FixtureMap {
  return {
    "https://acme.com/": html(HOMEPAGE_HTML),
    "https://acme.com/llms.txt": html(LLMS_TXT, "text/plain"),
    "https://acme.com/robots.txt": html(ROBOTS_TXT, "text/plain"),
    "https://acme.com/sitemap.txt": notFound(),
    "https://acme.com/sitemap.xml": notFound(),
    "https://acme.com/about": html(HTML_MAIN_CONTENT),
    "https://acme.com/pricing": html(HTML_MAIN_CONTENT),
    "https://acme.com/blog/post-1": html(HTML_ARTICLE_CONTENT),
  };
}

// Pre-built fixture: site with sitemap.txt (no llms.txt)
export function sitemapTxtSite(): FixtureMap {
  return {
    "https://acme.com/": html(HOMEPAGE_HTML),
    "https://acme.com/llms.txt": notFound(),
    "https://acme.com/robots.txt": html(ROBOTS_TXT, "text/plain"),
    "https://acme.com/sitemap.txt": html(SITEMAP_TXT, "text/plain"),
    "https://acme.com/about": html(HTML_MAIN_CONTENT),
    "https://acme.com/pricing": html(HTML_MAIN_CONTENT),
  };
}

// Pre-built fixture: site with sitemap.xml only (should prefer txt if both exist)
export function sitemapXmlSite(): FixtureMap {
  return {
    "https://acme.com/": html(HOMEPAGE_HTML.replace('href="/sitemap.txt"', 'href="/sitemap.xml"')),
    "https://acme.com/llms.txt": notFound(),
    "https://acme.com/robots.txt": notFound(),
    "https://acme.com/sitemap.txt": notFound(),
    "https://acme.com/sitemap.xml": html(SITEMAP_XML, "application/xml"),
    "https://acme.com/about": html(HTML_MAIN_CONTENT),
    "https://acme.com/pricing": html(HTML_MAIN_CONTENT),
  };
}

// Pre-built fixture: nav-only site (no llms.txt, no sitemap)
export function navOnlySite(): FixtureMap {
  const homepageNoSitemap = HOMEPAGE_HTML
    .replace('<link rel="sitemap" href="/sitemap.txt" />', '')
    .replace('<link rel="alternate" type="application/rss+xml" href="/feed.xml" />', '');
  return {
    "https://acme.com/": html(homepageNoSitemap),
    "https://acme.com/llms.txt": notFound(),
    "https://acme.com/robots.txt": notFound(),
    "https://acme.com/sitemap.txt": notFound(),
    "https://acme.com/sitemap.xml": notFound(),
    "https://acme.com/about": html(HTML_MAIN_CONTENT),
    "https://acme.com/pricing": html(HTML_MAIN_CONTENT),
  };
}
```

**Step 2: Create empty test shells**

```ts
// test/lib/scrape/extract.test.ts
import { describe } from "vitest";
describe("extract", () => {});

// test/lib/scrape/discover.test.ts
import { describe } from "vitest";
describe("discover", () => {});

// test/lib/scrape/crawl.test.ts
import { describe } from "vitest";
describe("crawl", () => {});
```

**Step 3: Run to confirm test infrastructure works**

```bash
pnpm vitest run test/lib/scrape/
```
Expected: 3 test suites, 0 tests, all pass.

**Step 4: Commit**

```bash
git add test/lib/scrape/
git commit -m "test: add scraper test fixtures and empty test shells"
```

---

### Task 3: `extract.ts` — Markdown passthrough and JSON-LD extraction

**Files:**
- Modify: `app/lib/scrape/extract.ts`
- Modify: `test/lib/scrape/extract.test.ts`

**Step 1: Write failing tests**

```ts
// test/lib/scrape/extract.test.ts
import { describe, expect, it, vi } from "vitest";
import { fetchAndExtract } from "~/lib/scrape/extract";
import {
  MARKDOWN_RESPONSE,
  JSON_LD_HTML,
  mockFetch,
} from "./fixtures";

describe("fetchAndExtract", () => {
  it("should return markdown body directly when content-type is text/markdown", async () => {
    vi.stubGlobal("fetch", mockFetch({
      "https://acme.com/about": {
        ok: true,
        status: 200,
        headers: { get: (h) => h === "content-type" ? "text/markdown" : null },
        text: async () => MARKDOWN_RESPONSE,
      },
    }));
    const result = await fetchAndExtract("https://acme.com/about", AbortSignal.timeout(5000));
    expect(result).not.toBeNull();
    expect(result!.text).toContain("We build great things");
    expect(result!.text).toContain("Our Mission");
  });

  it("should extract articleBody from JSON-LD when present", async () => {
    vi.stubGlobal("fetch", mockFetch({
      "https://acme.com/article": {
        ok: true,
        status: 200,
        headers: { get: (h) => h === "content-type" ? "text/html" : null },
        text: async () => JSON_LD_HTML,
      },
    }));
    const result = await fetchAndExtract("https://acme.com/article", AbortSignal.timeout(5000));
    expect(result).not.toBeNull();
    expect(result!.text).toContain("main article content extracted from JSON-LD");
    expect(result!.text).not.toContain("noisy sidebar");
  });

  it("should return null when fetch response is not ok", async () => {
    vi.stubGlobal("fetch", mockFetch({})); // all 404
    const result = await fetchAndExtract("https://acme.com/missing", AbortSignal.timeout(5000));
    expect(result).toBeNull();
  });

  it("should return null when content-type is not HTML or Markdown", async () => {
    vi.stubGlobal("fetch", mockFetch({
      "https://acme.com/file.pdf": {
        ok: true,
        status: 200,
        headers: { get: (h) => h === "content-type" ? "application/pdf" : null },
        text: async () => "binary content",
      },
    }));
    const result = await fetchAndExtract("https://acme.com/file.pdf", AbortSignal.timeout(5000));
    expect(result).toBeNull();
  });
});
```

**Step 2: Run tests — verify they fail**

```bash
pnpm vitest run test/lib/scrape/extract.test.ts
```
Expected: FAIL — `fetchAndExtract` returns null (stub implementation).

**Step 3: Implement `app/lib/scrape/extract.ts`**

```ts
// app/lib/scrape/extract.ts
import { getElementsByTagName, getMainContent, htmlToMarkdown } from "~/lib/html/parseHTML";
import parseHTMLTree from "~/lib/html/parseHTML";

export type ExtractionResult = {
  title: string;
  text: string;
};

const SUPPORTED_CONTENT_TYPES = ["text/html", "text/markdown"];

export async function fetchAndExtract(
  url: string,
  signal: AbortSignal,
): Promise<ExtractionResult | null> {
  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(5_000)]),
      redirect: "follow",
      headers: { Accept: "text/markdown, text/html;q=0.9" },
    });
  } catch {
    return null;
  }

  if (!response.ok) return null;

  const contentType = response.headers.get("content-type") ?? "";
  if (!SUPPORTED_CONTENT_TYPES.some((t) => contentType.includes(t))) return null;

  const body = await response.text();

  if (contentType.includes("text/markdown")) return extractFromMarkdown(body, url);
  return extractFromHtml(body, url);
}

function extractFromMarkdown(body: string, url: string): ExtractionResult {
  const firstLine = body.split("\n").find((l) => l.startsWith("# "));
  const title = firstLine ? firstLine.replace(/^#\s+/, "") : new URL(url).pathname;
  return { title, text: body };
}

function extractFromHtml(html: string, url: string): ExtractionResult {
  const tree = parseHTMLTree(html);

  // Title
  const titleNodes = getElementsByTagName(tree, "title");
  const title =
    titleNodes[0]?.children
      .filter((n) => n.type === "text")
      .map((n) => (n.type === "text" ? n.content : ""))
      .join("") ?? new URL(url).pathname;

  // 1. Check rel=canonical — if it points elsewhere, return empty (caller will skip)
  const links = getElementsByTagName(tree, "link");
  for (const link of links) {
    if (link.attributes.rel === "canonical") {
      const canonical = link.attributes.href;
      if (canonical && canonical !== url && new URL(canonical).pathname !== new URL(url).pathname) {
        return { title, text: "" }; // signal to caller to skip
      }
    }
  }

  // 2. JSON-LD articleBody
  const scripts = getElementsByTagName(tree, "script");
  for (const script of scripts) {
    if (script.attributes.type !== "application/ld+json") continue;
    const raw = script.children
      .filter((n) => n.type === "text")
      .map((n) => (n.type === "text" ? n.content : ""))
      .join("");
    try {
      const ld = JSON.parse(raw);
      const articleBody = ld?.articleBody ?? ld?.description;
      if (articleBody && typeof articleBody === "string" && articleBody.length > 50) {
        return { title, text: articleBody };
      }
    } catch {
      // malformed JSON-LD — continue to HTML extraction
    }
  }

  // 3. Semantic HTML extraction
  const text = extractSemanticContent(tree, html);
  return { title, text };
}

function extractSemanticContent(
  tree: ReturnType<typeof parseHTMLTree>,
  html: string,
): string {
  // Try semantic selectors in priority order
  const candidates = [
    () => getElementsByTagName(tree, "main")[0],
    () => getElementsByTagName(tree, "article")[0],
    () => {
      const all = getElementsByTagName(tree, "*" as never);
      return all.find(
        (n) =>
          "attributes" in n &&
          (n.attributes.role === "main" ||
            n.attributes.id === "content" ||
            n.attributes.id === "main" ||
            n.attributes.id === "root"),
      );
    },
  ];

  for (const selector of candidates) {
    const node = selector();
    if (node) return htmlToMarkdown(node.children ?? []);
  }

  // Fallback: existing getMainContent
  return htmlToMarkdown(getMainContent(tree));
}
```

**Step 4: Run tests — verify they pass**

```bash
pnpm vitest run test/lib/scrape/extract.test.ts
```
Expected: all passing.

**Step 5: Commit**

```bash
git add app/lib/scrape/extract.ts test/lib/scrape/extract.test.ts
git commit -m "feat: implement extract.ts with Markdown passthrough and JSON-LD extraction"
```

---

### Task 4: `extract.ts` — semantic HTML selectors and canonical skip

**Files:**
- Modify: `test/lib/scrape/extract.test.ts`

The implementation is already written in Task 3. This task adds tests to verify each selector branch.

**Step 1: Add tests**

```ts
// append to the describe block in extract.test.ts

  it("should extract content from <main> element", async () => {
    vi.stubGlobal("fetch", mockFetch({
      "https://acme.com/page": {
        ok: true, status: 200,
        headers: { get: (h) => h === "content-type" ? "text/html" : null },
        text: async () => HTML_MAIN_CONTENT,  // import from fixtures
      },
    }));
    const result = await fetchAndExtract("https://acme.com/page", AbortSignal.timeout(5000));
    expect(result!.text).toContain("main content of the page");
    expect(result!.text).not.toContain("Nav stuff");
    expect(result!.text).not.toContain("Footer stuff");
  });

  it("should extract content from <article> element", async () => {
    vi.stubGlobal("fetch", mockFetch({
      "https://acme.com/blog/post": {
        ok: true, status: 200,
        headers: { get: (h) => h === "content-type" ? "text/html" : null },
        text: async () => HTML_ARTICLE_CONTENT, // import from fixtures
      },
    }));
    const result = await fetchAndExtract("https://acme.com/blog/post", AbortSignal.timeout(5000));
    expect(result!.text).toContain("article content that should be extracted");
    expect(result!.text).not.toContain("Navigation ignored");
  });

  it("should extract content from [role=main] when no main/article", async () => {
    vi.stubGlobal("fetch", mockFetch({
      "https://acme.com/app": {
        ok: true, status: 200,
        headers: { get: (h) => h === "content-type" ? "text/html" : null },
        text: async () => HTML_ROLE_MAIN,
      },
    }));
    const result = await fetchAndExtract("https://acme.com/app", AbortSignal.timeout(5000));
    expect(result!.text).toContain("Content inside role=main");
  });

  it("should return empty text for pages with rel=canonical pointing elsewhere", async () => {
    vi.stubGlobal("fetch", mockFetch({
      "https://acme.com/duplicate": {
        ok: true, status: 200,
        headers: { get: (h) => h === "content-type" ? "text/html" : null },
        text: async () => CANONICAL_SKIP_HTML,
      },
    }));
    const result = await fetchAndExtract("https://acme.com/duplicate", AbortSignal.timeout(5000));
    expect(result!.text).toBe("");
  });
```

**Step 2: Import missing fixtures in extract.test.ts**

Add to imports:
```ts
import {
  MARKDOWN_RESPONSE, JSON_LD_HTML, HTML_MAIN_CONTENT,
  HTML_ARTICLE_CONTENT, HTML_ROLE_MAIN, CANONICAL_SKIP_HTML,
  mockFetch,
} from "./fixtures";
```

**Step 3: Run tests**

```bash
pnpm vitest run test/lib/scrape/extract.test.ts
```
Expected: all passing.

**Step 4: Commit**

```bash
git add test/lib/scrape/extract.test.ts
git commit -m "test: add semantic HTML and canonical-skip extraction tests"
```

---

### Task 5: `discover.ts` — llms.txt, robots.txt, sitemap

**Files:**
- Modify: `app/lib/scrape/discover.ts`
- Modify: `test/lib/scrape/discover.test.ts`

**Step 1: Write failing tests**

```ts
// test/lib/scrape/discover.test.ts
import { describe, expect, it, vi } from "vitest";
import { discoverUrls } from "~/lib/scrape/discover";
import {
  HOMEPAGE_HTML, mockFetch,
  llmsTxtSite, sitemapTxtSite, sitemapXmlSite, navOnlySite,
} from "./fixtures";

describe("discoverUrls", () => {
  it("should put llms.txt URLs first in the queue", async () => {
    vi.stubGlobal("fetch", mockFetch(llmsTxtSite()));
    const { urls } = await discoverUrls({
      domain: "acme.com",
      homepageHtml: HOMEPAGE_HTML,
      signal: AbortSignal.timeout(5000),
    });
    expect(urls[0]).toBe("https://acme.com/about");
    expect(urls[1]).toBe("https://acme.com/pricing");
    expect(urls[2]).toBe("https://acme.com/blog/post-1");
  });

  it("should filter URLs matching robots.txt Disallow rules", async () => {
    vi.stubGlobal("fetch", mockFetch({
      ...llmsTxtSite(),
      "https://acme.com/llms.txt": {
        ok: true, status: 200,
        headers: { get: (h) => h === "content-type" ? "text/plain" : null },
        text: async () => "https://acme.com/about\nhttps://acme.com/admin/secret\n",
      },
    }));
    const { urls } = await discoverUrls({
      domain: "acme.com",
      homepageHtml: HOMEPAGE_HTML,
      signal: AbortSignal.timeout(5000),
    });
    expect(urls).toContain("https://acme.com/about");
    expect(urls).not.toContain("https://acme.com/admin/secret");
  });

  it("should use sitemap.txt when available (not sitemap.xml)", async () => {
    vi.stubGlobal("fetch", mockFetch({
      ...sitemapTxtSite(),
      // also make sitemap.xml available — should be ignored
      "https://acme.com/sitemap.xml": {
        ok: true, status: 200,
        headers: { get: (h) => h === "content-type" ? "application/xml" : null },
        text: async () => `<urlset><url><loc>https://acme.com/xml-only-page</loc></url></urlset>`,
      },
    }));
    const { urls } = await discoverUrls({
      domain: "acme.com",
      homepageHtml: HOMEPAGE_HTML,
      signal: AbortSignal.timeout(5000),
    });
    expect(urls).toContain("https://acme.com/about");
    expect(urls).not.toContain("https://acme.com/xml-only-page");
  });

  it("should fall back to sitemap.xml when no sitemap.txt", async () => {
    vi.stubGlobal("fetch", mockFetch(sitemapXmlSite()));
    const { urls } = await discoverUrls({
      domain: "acme.com",
      homepageHtml: HOMEPAGE_HTML.replace('href="/sitemap.txt"', 'href="/sitemap.xml"'),
      signal: AbortSignal.timeout(5000),
    });
    expect(urls).toContain("https://acme.com/about");
    expect(urls).toContain("https://acme.com/pricing");
  });

  it("should fall back to nav links when no sitemap", async () => {
    vi.stubGlobal("fetch", mockFetch(navOnlySite()));
    const { urls } = await discoverUrls({
      domain: "acme.com",
      homepageHtml: navOnlySite()["https://acme.com/"].text(),
      signal: AbortSignal.timeout(5000),
    });
    expect(urls).toContain("https://acme.com/about");
    expect(urls).toContain("https://acme.com/pricing");
  });
});
```

**Step 2: Run — verify fail**

```bash
pnpm vitest run test/lib/scrape/discover.test.ts
```

**Step 3: Implement `app/lib/scrape/discover.ts`**

```ts
// app/lib/scrape/discover.ts
import { getElementsByTagName } from "~/lib/html/parseHTML";
import parseHTMLTree from "~/lib/html/parseHTML";

const MEDIA_EXTENSIONS = /\.(pdf|jpg|jpeg|png|gif|svg|webp|mp4|mp3|zip|exe)$/i;

export type DiscoveryResult = {
  urls: string[];
  disallowedPaths: Set<string>;
};

export async function discoverUrls({
  domain,
  homepageHtml,
  signal,
}: {
  domain: string;
  homepageHtml: string;
  signal: AbortSignal;
}): Promise<DiscoveryResult> {
  const base = `https://${domain}`;
  const pageSignal = () => AbortSignal.any([signal, AbortSignal.timeout(3_000)]);

  // Run all probes in parallel
  const [llmsUrls, disallowedPaths, sitemapUrls, rssUrls] = await Promise.all([
    fetchLlmsTxt(base, pageSignal()),
    fetchRobotsTxt(base, pageSignal()),
    fetchSitemapUrls(base, domain, homepageHtml, pageSignal()),
    fetchRssUrls(base, domain, homepageHtml, pageSignal()),
  ]);

  // Merge: llms.txt first, then sitemap/RSS, then nav — deduplicated
  const homepageTree = parseHTMLTree(homepageHtml);
  const navUrls = extractNavUrls({ domain, tree: homepageTree });

  const all = dedup([...llmsUrls, ...sitemapUrls, ...rssUrls, ...navUrls]);
  const filtered = all.filter((url) => !isDisallowed(url, disallowedPaths));

  return { urls: filtered, disallowedPaths };
}

async function fetchLlmsTxt(base: string, signal: AbortSignal): Promise<string[]> {
  try {
    const res = await fetch(`${base}/llms.txt`, { signal });
    if (!res.ok) return [];
    const text = await res.text();
    return text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /^https?:\/\//.test(l));
  } catch {
    return [];
  }
}

async function fetchRobotsTxt(
  base: string,
  signal: AbortSignal,
): Promise<Set<string>> {
  try {
    const res = await fetch(`${base}/robots.txt`, { signal });
    if (!res.ok) return new Set();
    const text = await res.text();
    const disallowed = new Set<string>();
    for (const line of text.split("\n")) {
      const match = line.match(/^Disallow:\s*(.+)/i);
      if (match?.[1]) disallowed.add(match[1].trim());
    }
    return disallowed;
  } catch {
    return new Set();
  }
}

async function fetchSitemapUrls(
  base: string,
  domain: string,
  homepageHtml: string,
  signal: AbortSignal,
): Promise<string[]> {
  // Check homepage for <link rel="sitemap"> hint
  const tree = parseHTMLTree(homepageHtml);
  const links = getElementsByTagName(tree, "link");
  let hintedSitemapUrl: string | null = null;
  for (const link of links) {
    if (link.attributes.rel === "sitemap" && link.attributes.href) {
      hintedSitemapUrl = new URL(link.attributes.href, base).href;
      break;
    }
  }

  // Prefer sitemap.txt — try hinted URL if it's .txt, else try /sitemap.txt, then /sitemap.xml
  const txtUrl = hintedSitemapUrl?.endsWith(".txt")
    ? hintedSitemapUrl
    : `${base}/sitemap.txt`;

  const txtResult = await tryFetchSitemapTxt(txtUrl, domain, signal);
  if (txtResult.length > 0) return txtResult;

  const xmlUrl = hintedSitemapUrl?.endsWith(".xml")
    ? hintedSitemapUrl
    : `${base}/sitemap.xml`;
  return tryFetchSitemapXml(xmlUrl, domain, signal);
}

async function tryFetchSitemapTxt(
  url: string,
  domain: string,
  signal: AbortSignal,
): Promise<string[]> {
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return [];
    const text = await res.text();
    return text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => {
        if (!/^https?:\/\//.test(l)) return false;
        try {
          const u = new URL(l);
          return u.hostname === domain && !MEDIA_EXTENSIONS.test(u.pathname);
        } catch {
          return false;
        }
      });
  } catch {
    return [];
  }
}

async function tryFetchSitemapXml(
  url: string,
  domain: string,
  signal: AbortSignal,
): Promise<string[]> {
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return [];
    const xml = await res.text();
    const locs: string[] = [];
    const locRegex = /<loc>(.*?)<\/loc>/g;
    for (let match = locRegex.exec(xml); match !== null; match = locRegex.exec(xml)) {
      const u = match[1]?.trim();
      if (!u) continue;
      try {
        const parsed = new URL(u);
        if (parsed.hostname !== domain) continue;
        if (MEDIA_EXTENSIONS.test(parsed.pathname)) continue;
        locs.push(u);
      } catch {
        // ignore
      }
    }
    return locs;
  } catch {
    return [];
  }
}

async function fetchRssUrls(
  base: string,
  domain: string,
  homepageHtml: string,
  signal: AbortSignal,
): Promise<string[]> {
  try {
    const tree = parseHTMLTree(homepageHtml);
    const links = getElementsByTagName(tree, "link");
    let feedUrl: string | null = null;
    for (const link of links) {
      const type = link.attributes.type ?? "";
      if (type.includes("rss") || type.includes("atom")) {
        feedUrl = link.attributes.href
          ? new URL(link.attributes.href, base).href
          : null;
        break;
      }
    }
    if (!feedUrl) return [];

    const res = await fetch(feedUrl, { signal });
    if (!res.ok) return [];
    const xml = await res.text();

    const urls: string[] = [];
    const linkRegex = /<link>(.*?)<\/link>/g;
    for (let match = linkRegex.exec(xml); match !== null; match = linkRegex.exec(xml)) {
      const u = match[1]?.trim();
      if (!u) continue;
      try {
        const parsed = new URL(u);
        if (parsed.hostname === domain) urls.push(u);
      } catch {
        // ignore
      }
    }
    return urls;
  } catch {
    return [];
  }
}

function extractNavUrls({
  domain,
  tree,
}: {
  domain: string;
  tree: ReturnType<typeof parseHTMLTree>;
}): string[] {
  const navs = getElementsByTagName(tree, "nav");
  const anchors =
    navs.length > 0
      ? navs.flatMap((nav) => getElementsByTagName(nav.children, "a"))
      : getElementsByTagName(tree, "a");

  const seen = new Set<string>();
  const urls: string[] = [];

  for (const anchor of anchors) {
    const href = anchor.attributes.href;
    if (!href || href.startsWith("#") || href.startsWith("mailto:")) continue;
    if (MEDIA_EXTENSIONS.test(href)) continue;
    let url: URL;
    try {
      url = new URL(href.startsWith("http") ? href : `https://${domain}${href}`);
    } catch {
      continue;
    }
    if (url.hostname !== domain) continue;
    if (url.pathname === "/" || url.pathname === "") continue;
    const depth = url.pathname.split("/").filter(Boolean).length;
    if (depth > 3) continue;
    const key = url.origin + url.pathname;
    if (seen.has(key)) continue;
    seen.add(key);
    urls.push(url.href);
  }

  return urls;
}

function isDisallowed(url: string, disallowedPaths: Set<string>): boolean {
  try {
    const { pathname } = new URL(url);
    for (const pattern of disallowedPaths) {
      if (pathname.startsWith(pattern)) return true;
    }
  } catch {
    // ignore
  }
  return false;
}

function dedup(urls: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const url of urls) {
    try {
      const { origin, pathname } = new URL(url);
      const key = origin + pathname.replace(/\/$/, "");
      if (!seen.has(key)) {
        seen.add(key);
        result.push(url);
      }
    } catch {
      // ignore malformed
    }
  }
  return result;
}
```

**Step 4: Run tests**

```bash
pnpm vitest run test/lib/scrape/discover.test.ts
```
Expected: all passing.

**Step 5: Commit**

```bash
git add app/lib/scrape/discover.ts test/lib/scrape/discover.test.ts
git commit -m "feat: implement discover.ts with llms.txt, robots.txt, sitemap, RSS, nav"
```

---

### Task 6: `discover.ts` — RSS feed test

**Files:**
- Modify: `test/lib/scrape/discover.test.ts`

**Step 1: Add RSS test**

```ts
  it("should extract URLs from RSS feed link in homepage head", async () => {
    vi.stubGlobal("fetch", mockFetch({
      "https://acme.com/llms.txt": { ok: false, status: 404, headers: { get: () => null }, text: async () => "" },
      "https://acme.com/robots.txt": { ok: false, status: 404, headers: { get: () => null }, text: async () => "" },
      "https://acme.com/sitemap.txt": { ok: false, status: 404, headers: { get: () => null }, text: async () => "" },
      "https://acme.com/sitemap.xml": { ok: false, status: 404, headers: { get: () => null }, text: async () => "" },
      "https://acme.com/feed.xml": {
        ok: true, status: 200,
        headers: { get: (h) => h === "content-type" ? "application/rss+xml" : null },
        text: async () => RSS_FEED,
      },
    }));
    const { urls } = await discoverUrls({
      domain: "acme.com",
      homepageHtml: HOMEPAGE_HTML, // has <link rel="alternate" type="application/rss+xml" href="/feed.xml">
      signal: AbortSignal.timeout(5000),
    });
    expect(urls).toContain("https://acme.com/blog/post-1");
    expect(urls).toContain("https://acme.com/blog/post-2");
  });
```

Also add `RSS_FEED` to the imports from `./fixtures`.

**Step 2: Run tests**

```bash
pnpm vitest run test/lib/scrape/discover.test.ts
```
Expected: all passing.

**Step 3: Commit**

```bash
git add test/lib/scrape/discover.test.ts
git commit -m "test: add RSS feed discovery test"
```

---

### Task 7: `crawl.ts` — bounded-concurrency queue with limits

**Files:**
- Modify: `app/lib/scrape/crawl.ts` — replace stub with full implementation
- Modify: `test/lib/scrape/crawl.test.ts`

**Step 1: Write failing tests**

```ts
// test/lib/scrape/crawl.test.ts
import { describe, expect, it, vi } from "vitest";
import { crawl } from "~/lib/scrape/crawl";
import { mockFetch, llmsTxtSite, navOnlySite, HTML_MAIN_CONTENT } from "./fixtures";

describe("crawl", () => {
  it("should stop fetching pages when maxWords is reached", async () => {
    // homepage has a lot of words, second page should not be fetched
    const longPage = `<html><head><title>Home</title></head><body><main>${"word ".repeat(6000)}</main></body></html>`;
    let fetchCount = 0;
    vi.stubGlobal("fetch", async (url: string) => {
      fetchCount++;
      return {
        ok: true, status: 200,
        headers: { get: (h: string) => h === "content-type" ? "text/html" : null },
        text: async () => longPage,
      };
    });
    await crawl({ domain: "acme.com", maxWords: 5_000, maxPages: 20, maxSeconds: 10 });
    // homepage fetch + discovery probes (llms, robots, sitemap, rss) + no content pages
    expect(fetchCount).toBeLessThan(10); // key: didn't fetch 20 content pages
  });

  it("should not fetch more than maxPages content pages", async () => {
    const pages: Record<string, boolean> = {};
    vi.stubGlobal("fetch", async (url: string) => {
      pages[url] = true;
      return {
        ok: true, status: 200,
        headers: { get: (h: string) => h === "content-type" ? "text/html" : null },
        text: async () => HTML_MAIN_CONTENT,
      };
    });
    // Make sitemap return 30 URLs
    const manyUrls = Array.from({ length: 30 }, (_, i) => `https://acme.com/page-${i}`).join("\n");
    vi.stubGlobal("fetch", async (url: string) => {
      if (url.includes("sitemap.txt")) {
        return { ok: true, status: 200, headers: { get: (h: string) => h === "content-type" ? "text/plain" : null }, text: async () => manyUrls };
      }
      return { ok: true, status: 200, headers: { get: (h: string) => h === "content-type" ? "text/html" : null }, text: async () => HTML_MAIN_CONTENT };
    });
    await crawl({ domain: "acme.com", maxWords: 50_000, maxPages: 5, maxSeconds: 10 });
    const contentFetches = Object.keys(pages).filter((u) => u.includes("/page-")).length;
    expect(contentFetches).toBeLessThanOrEqual(5);
  });

  it("should return content from llms.txt URLs before other URLs", async () => {
    vi.stubGlobal("fetch", mockFetch(llmsTxtSite()));
    const content = await crawl({ domain: "acme.com", maxWords: 5_000, maxPages: 5, maxSeconds: 10 });
    // llms.txt lists /about, /pricing, /blog/post-1 — these come first
    // their content is HTML_MAIN_CONTENT which contains "main content of the page"
    expect(content).toContain("main content");
  });

  it("should combine content from multiple pages", async () => {
    vi.stubGlobal("fetch", mockFetch(navOnlySite()));
    const content = await crawl({ domain: "acme.com", maxWords: 5_000, maxPages: 5, maxSeconds: 10 });
    expect(content.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run — verify fail**

```bash
pnpm vitest run test/lib/scrape/crawl.test.ts
```

**Step 3: Implement `app/lib/scrape/crawl.ts`**

```ts
// app/lib/scrape/crawl.ts
import debug from "debug";
import { discoverUrls } from "./discover";
import { fetchAndExtract } from "./extract";

const logger = debug("fetch");

export async function crawl({
  domain,
  maxWords = 5_000,
  maxPages = 20,
  maxSeconds = 10,
}: {
  domain: string;
  maxWords?: number;
  maxPages?: number;
  maxSeconds?: number;
}): Promise<string> {
  const signal = AbortSignal.timeout(maxSeconds * 1_000);
  const base = `https://${domain}`;

  // Fetch homepage first — needed for discovery
  const homepageRes = await fetch(`${base}/`, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(5_000)]),
    redirect: "follow",
    headers: { Accept: "text/markdown, text/html;q=0.9" },
  });
  if (!homepageRes.ok)
    throw new Error(`HTTP ${homepageRes.status} fetching ${domain}`);

  const homepageBody = await homepageRes.text();
  const homepageContentType = homepageRes.headers.get("content-type") ?? "";

  // Discover additional URLs (parallel probes)
  const { urls: candidateUrls } = await discoverUrls({
    domain,
    homepageHtml: homepageContentType.includes("text/markdown") ? "" : homepageBody,
    signal,
  });

  // Extract homepage content
  const homepageExtraction = homepageContentType.includes("text/markdown")
    ? { title: domain, text: homepageBody }
    : extractHomepageFromHtml(homepageBody, base);

  // Bounded-concurrency queue
  const CONCURRENCY = 3;
  const results: { url: string; title: string; text: string }[] = [];
  if (homepageExtraction.text.trim()) {
    results.push({ url: base, ...homepageExtraction });
  }

  let wordCount = countWords(homepageExtraction.text);
  let pagesFetched = 1; // homepage counts as 1

  const queue = [...candidateUrls];
  const inFlight = new Set<Promise<void>>();

  async function processNext(): Promise<void> {
    while (queue.length > 0 && !signal.aborted && wordCount < maxWords && pagesFetched < maxPages) {
      const url = queue.shift();
      if (!url) break;

      pagesFetched++;
      const task = fetchAndExtract(url, signal).then((result) => {
        if (result && result.text.trim()) {
          wordCount += countWords(result.text);
          results.push({ url, ...result });
        }
        inFlight.delete(task);
      }).catch(() => {
        inFlight.delete(task);
      });

      inFlight.add(task);

      if (inFlight.size >= CONCURRENCY) {
        await Promise.race(inFlight);
      }
    }
  }

  // Start CONCURRENCY workers
  const workers = Array.from({ length: CONCURRENCY }, () => processNext());
  await Promise.all([...workers, ...inFlight]);

  const parts = results.map(({ title, text }) => `## ${title}\n\n${text}`);
  const combined = parts.join("\n\n---\n\n");
  const words = combined.split(/\s+/);
  logger("Crawled %s pages => %s words", results.length, words.length);
  return words.slice(0, maxWords).join(" ");
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function extractHomepageFromHtml(html: string, base: string): { title: string; text: string } {
  // Inline a minimal extraction for the homepage (avoids circular import)
  // Real extraction happens via fetchAndExtract for all other pages
  try {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch?.[1] ?? new URL(base).hostname;
    const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    const text = mainMatch?.[1]?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() ?? "";
    return { title, text };
  } catch {
    return { title: base, text: "" };
  }
}
```

**Step 4: Run tests**

```bash
pnpm vitest run test/lib/scrape/crawl.test.ts
```
Expected: all passing.

**Step 5: Commit**

```bash
git add app/lib/scrape/crawl.ts test/lib/scrape/crawl.test.ts
git commit -m "feat: implement bounded-concurrency crawl queue with word/page/time limits"
```

---

### Task 8: Clean up `sites.server.ts` and run full test suite

**Files:**
- Modify: `app/lib/sites.server.ts`
- Modify: `test/lib/sites.server.test.ts`

**Step 1: Update `sites.server.ts` import**

The old `fetchSiteContent` export should now delegate to `~/lib/scrape`:

```ts
// Replace existing fetchSiteContent + all crawler functions with:
export { fetchSiteContent } from "~/lib/scrape";
```

Remove from `sites.server.ts`:
- `MEDIA_EXTENSIONS` constant
- `CRAWL_BUDGET_MS` constant
- `logger` (if only used by crawler; keep if used elsewhere)
- `crawlSiteCustom` function
- `discoverUrls` function
- `fetchSitemapUrls` function
- `extractNavUrls` function
- Imports: `parseHTMLTree`, `getElementsByTagName`, `getMainContent`, `htmlToMarkdown` (unless used elsewhere)

**Step 2: Verify `test/lib/sites.server.test.ts`**

The test imports `fetchSiteContent` from `~/lib/sites.server` — since we re-export, this still works. Check that the test's mock still applies (it stubs global `fetch`). No change needed unless TypeScript complains.

**Step 3: Run full test suite**

```bash
pnpm vitest run test/lib/
```
Expected: all tests green.

**Step 4: Run typecheck**

```bash
pnpm test:typecheck
```
Fix any TypeScript errors.

**Step 5: Run lint**

```bash
pnpm check:lint
```
Fix any lint errors.

**Step 6: Commit**

```bash
git add app/lib/sites.server.ts test/lib/sites.server.test.ts
git commit -m "refactor: remove old crawler code from sites.server.ts"
```
