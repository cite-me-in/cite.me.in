# AI Legibility Checker

A diagnostic tool that validates whether a website is readable by AI agents — ChatGPT, Claude, Gemini, Perplexity, and others — and provides actionable fixes.

The scan runs **16 checks** organized into **3 categories** that correspond to the AI agent's experience: discovery, comprehension, and access.

---

## Categories

### Discovered — "Can AI agents find all my content?"

Tests whether AI crawlers can locate your pages through standard and emerging discovery mechanisms.

### Trusted — "Does my content present well when cited?"

Tests whether your pages return real, parseable content with proper metadata so AI agents can accurately reference and summarize them.

### Welcomed — "Are AI crawlers allowed on my site?"

Tests access control signals — robots.txt, noindex directives, content permissions, and real-world bot traffic behavior.

---

## Check Reference

### Discovered (6 checks)

| # | Check | What it checks | Why we run it | How to fix | Effort |
|---|-------|---------------|---------------|------------|--------|
| 1 | **sitemap.xml** | `/sitemap.xml` is accessible, parseable XML, and lists URLs. References URLs found in robots.txt `Sitemap` directives. | XML sitemaps are the canonical discovery mechanism for all major crawlers. Without one, AI agents may never find pages beyond your homepage. | Generate an XML sitemap (most CMS platforms do this automatically) and ensure it's served at `/sitemap.xml`. Reference it in robots.txt with `Sitemap: https://yoursite.com/sitemap.xml`. | 15 min |
| 2 | **sitemap.txt** | `/sitemap.txt` is accessible and returns a plain-text list of URLs, one per line. References sitemap URLs from robots.txt. | Many AI agents prefer plain-text sitemaps — they're trivially parseable without XML libraries. A supplement to, not replacement for, XML sitemaps. | Generate a plain-text version of your sitemap and serve it at `/sitemap.txt`. Add `Sitemap: https://yoursite.com/sitemap.txt` to robots.txt. | 5 min |
| 3 | **llms.txt** | `/llms.txt` exists per the llmstxt.org standard. | An emerging standard where sites declare an AI-specific content index. Direct signal to LLMs about what to index and how to use it. | Create `/llms.txt` following the [llmstxt.org](https://llmstxt.org/) specification. Include a curated list of your key pages with brief descriptions. | 15 min |
| 4 | **llms-full.txt** | `/llms-full.txt` exists. | Some AI agents (notably Claude) look for a full-site content dump for batch ingestion. | Generate `/llms-full.txt` containing the full text content of your site (or key pages), formatted for AI consumption. | 1 hr |
| 5 | **Sitemap link headers** | HTTP `Link` headers and HTML `<link rel="sitemap">` tags point to your sitemaps. | Crawlers don't always read robots.txt first. Link headers in HTTP responses give an immediate discovery path. | Add `Link: <https://yoursite.com/sitemap.xml>; rel="sitemap"` to your HTTP response headers. Add `<link rel="sitemap" href="/sitemap.xml">` to your HTML `<head>`. | 5 min |
| 6 | **Markdown alternate links** | Pages advertise Markdown versions via `<link rel="alternate" type="text/markdown">` in HTML and `Link` HTTP headers. | AI agents strongly prefer consuming content in Markdown format over HTML. If you produce Markdown versions, this is how they find them. | For each HTML page with a Markdown equivalent, add `<link rel="alternate" type="text/markdown" href="/page.md">` in the `<head>` and a corresponding `Link` HTTP header. | 5 min |

### Trusted (5 checks)

| # | Check | What it checks | Why we run it | How to fix | Effort |
|---|-------|---------------|---------------|------------|--------|
| 7 | **Page content** | Homepage returns >100 characters of meaningful text in raw HTML. Detects empty SPA shells. | If your homepage is a JavaScript-rendered shell, AI agents (which don't execute JS) see nothing. This is the single most common failure. | Implement server-side rendering (SSR) or static generation. At minimum, inject meaningful content into the initial HTML response — a hidden `<nav>` with links, or server-rendered content. | 1 hr+ |
| 8 | **Sample pages** | Up to 10 random pages from your sitemap each return >100 characters of real content. Pages that time out are flagged separately. | A working homepage doesn't mean your deep pages work. AI agents need to reach individual content pages. | Ensure all pages listed in your sitemap return real HTML content (not login walls, 404s, or empty shells). Fix pages that time out by optimizing server response time. | 15 min |
| 9 | **Meta tags** | Homepage + sample pages have meta description, Open Graph tags, and canonical URLs. | Meta descriptions influence how AI agents summarize your content in citations. OG tags control previews. Canonical URLs prevent duplicate content confusion. | Add `<meta name="description">`, `<meta property="og:title">`, `<meta property="og:description">`, `<meta property="og:image">`, and `<link rel="canonical">` to all pages. | 5 min |
| 10 | **Markdown content negotiation** | Server supports `Accept: text/markdown` content negotiation. When an AI agent asks for Markdown, does your server serve it? | AI agents prefer Markdown. If your server can negotiate content types, agents get cleaner, more structured content. | Configure your web server to detect `Accept: text/markdown` headers and return Markdown versions of your pages. Use middleware or a reverse proxy to handle negotiation. | 1 hr |
| 11 | **.md routes** | URLs advertised via `<link rel="alternate" type="text/markdown">` actually serve valid Markdown content (>50 chars, correct `Content-Type: text/markdown`). | If you advertise Markdown endpoints, they must actually work. Broken or invalid Markdown routes waste crawler budget and reduce trust. | Ensure every URL advertised via `<link rel="alternate" type="text/markdown">` responds with `Content-Type: text/markdown` and at least 50 characters of meaningful Markdown content. Example: `<link rel="alternate" type="text/markdown" href="/page.md">` → the URL `/page.md` must serve valid Markdown with correct Content-Type header. | 1 hr |

### Welcomed (5 checks)

| # | Check | What it checks | Why we run it | How to fix | Effort |
|---|-------|---------------|---------------|------------|--------|
| 12 | **robots.txt** | `/robots.txt` is present, parseable, and doesn't block known AI bot User-Agents (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, etc.). | A missing or misconfigured robots.txt is the fastest way to get excluded from all AI crawlers. Many sites accidentally block AI bots while allowing Googlebot. | Create or audit your robots.txt. Ensure AI bot User-Agents are not disallowed from your content. Use `Disallow:` (allow all) for AI bots unless you have a specific reason to block them. | 2 min |
| 13 | **Robots directives (noindex)** | Homepage + sample pages don't have `<meta name="robots" content="noindex">` or `X-Robots-Tag: noindex` HTTP headers. | A single `noindex` tag on key pages can hide your entire site from AI agents. Often accidentally left on staging pages that get promoted to production. | Search your HTML templates and server config for `noindex` directives. Remove them from pages you want indexed by AI agents. Use `index` explicitly to override. | 5 min |
| 14 | **Content Signals** | `robots.txt` declares a `Content-Signal` directive with `search`, `ai-input`, or `ai-train` permissions. | Content Signals (draft proposal) let you explicitly grant or deny permission for AI-specific uses like training and retrieval-augmented generation. | Add a `Content-Signal` directive to your robots.txt. Example: `Content-Signal: search=allow, ai-input=allow, ai-train=disallow`. Each key controls a different use: search (indexing for search results), ai-input (real-time AI retrieval/grounding), and ai-train (model training). | 5 min |
| 15 | **JSON-LD** | Pages contain valid JSON-LD structured data with schema.org types (Organization, WebSite, Article, etc.) and pass basic schema validation. | Structured data helps AI agents understand entity relationships, authorship, publication dates, and more. It's how you tell AI agents what your content *means*, not just what it *says*. | Add JSON-LD `<script type="application/ld+json">` blocks to your pages. Include at minimum `Organization` (name, url) and `WebSite` (name, url) schemas on the homepage, and `Article` (headline, author) on content pages. These help AI agents understand entity relationships and accurately cite your content. | 15 min |
| 16 | **AI bot traffic** | Makes real HTTP requests using **7 AI bot User-Agent strings** to the homepage + up to 2 sample pages. Detects blocks via 403/401/429 status codes or short content matching WAF block page patterns. | robots.txt tells well-behaved bots what's allowed, but WAFs, CDN rules, and server configs may block AI bots regardless. This check reveals what AI agents actually experience. | The 7 tested User-Agent strings are: `GPTBot`, `ChatGPT-User`, `ClaudeBot`, `Claude-Web`, `Google-Extended`, `PerplexityBot`, `Perplexity-User`. A block is detected when the response is a 403, 401, or 429 status code, or when the response body is unusually short and matches common WAF block page patterns (e.g., "blocked", "access denied", "challenge", CAPTCHA content). To fix: whitelist these User-Agent strings at your CDN/WAF layer, or serve a static cache version to known AI bots. | 15 min |

---

## Diagnostic Flow

The checks have data dependencies — earlier checks produce results consumed by later ones. The execution order is:

```
  ┌─────────────────────────────────────────────────────────────┐
  │                     1. Page content                         │
  │      (homepage HTML, for downstream analysis)               │
  └──────────┬──────────────────────────────────────────────────┘
             │
  ┌──────────▼──────────────────────────────────────────────────┐
  │                     2. robots.txt                           │
  │      outputs: sitemapURLs[], robotsContent                  │
  └──────────┬──────────────────────────┬───────────────────────┘
             │                          │
  ┌──────────▼──────────┐   ┌──────────▼───────────────────────┐
  │  3. sitemap.xml      │   │     4. sitemap.txt              │
  │  (reads sitemapURLs  │   │  (reads sitemapURLs from        │
  │   from robots.txt)   │   │   robots.txt)                   │
  └──────────┬──────────┘   └──────────┬───────────────────────┘
             │                          │
             └──────────┬───────────────┘
                        │
  ┌─────────────────────▼──────────────────────────────────────┐
  │                  5. Sample pages                            │
  │  (URLs from sitemap.xml + sitemap.txt; fallback: homepage  │
  │   link extraction)                                          │
  │  outputs: sampleHTML[]                                       │
  └──────────┬──────────────────────────────────────────────────┘
             │
             ├────────────────────────────────────┐
             │                                    │
  ┌──────────▼──────────┐   ┌─────────────────────▼────────────┐
  │  6. JSON-LD          │   │       7. Meta tags              │
  │  (reads sampleHTML)  │   │  (reads sampleHTML)             │
  └─────────────────────┘   └──────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────┐
  │                     8. llms.txt                             │
  └─────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────┐
  │              9. Sitemap link headers                        │
  │   (reads homepage headers + HTML)                           │
  └─────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────┐
  │            10. Markdown alternate links                     │
  │      (reads homepage + sample pages HTML)                   │
  │      outputs: mdURLs[]                                       │
  └──────────┬──────────────────────────────────────────────────┘
             │
  ┌──────────▼──────────────────────────────────────────────────┐
  │               11. .md routes                                │
  │         (reads mdURLs from check 10)                        │
  └─────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────┐
  │           12. Robots directives (noindex)                   │
  │         (reads homepage + sample pages HTML)                │
  └─────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────┐
  │         13. Markdown content negotiation                    │
  │     (reads homepage + sample page URLs)                    │
  └─────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────┐
  │             14. Content Signals                              │
  │         (reads robotsContent from check 2)                  │
  └─────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────┐
  │            15. AI bot traffic                                │
  │     (reads homepage + sample page URLs)                    │
  └─────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────┐
  │                 16. llms-full.txt                           │
  └─────────────────────────────────────────────────────────────┘
```

---

## Effort Estimation

Estimated time to implement a fix for each check, ordered from quickest to most involved:

| Effort | Checks |
|--------|--------|
| **2 min** | robots.txt |
| **5 min** | sitemap.txt, Sitemap link headers, Markdown alternate links, Meta tags, Robots directives (noindex), Content Signals |
| **15 min** | sitemap.xml, Sample pages, llms.txt, JSON-LD, AI bot traffic (config) |
| **1 hr** | llms-full.txt, .md routes, Markdown content negotiation |
| **1 hr+** | Page content (SSR) |

---

## Output Format

### Activity Log

Displayed live during the scan so users see progress:

```
✓ Page content — Homepage returns 1,247 characters
✓ robots.txt — Found, no AI bot blocks
✓ sitemap.xml — Found with 47 URLs
✓ sitemap.txt — Found with 47 URLs
✓ Sample pages — 8/10 passed, 2 timed out
✓ JSON-LD — Found on homepage and 6/8 sample pages
✓ Meta tags — Found on 9/10 pages
✓ llms.txt — Not found
✗ Sitemap link headers — No Link header found
...
```

### Results Report

Grouped by category with pass/fail summary:

```
Discovered: 4/6 passed
  ✓ sitemap.xml — Accessible and parseable
  ✓ sitemap.txt — Found with 47 URLs
  ✗ llms.txt — Not found at /llms.txt
  ✗ llms-full.txt — Not found at /llms-full.txt
  ✓ Sitemap link headers — Link header present
  ✓ Markdown alternate links — Found on 3 pages

Trusted: 4/5 passed
  ✓ Page content — 1,247 chars of real content
  ✓ Sample pages — 8/10 passed
  ✓ Meta tags — 9/10 pages have all required tags
  ✗ Markdown content negotiation — Not supported
  ✓ .md routes — 3/3 routes serve valid Markdown

Welcomed: 4/5 passed
  ✓ robots.txt — Present, no AI bot blocks
  ✓ Robots directives — No noindex found
  ✗ Content Signals — Not declared in robots.txt
  ✓ JSON-LD — Valid on 7/10 pages
  ✓ AI bot traffic — 0/21 requests blocked
```

### Suggestions

One contextual suggestion is always generated:

**Hidden LLM hint** (2 min)
> Add a visually-hidden `<div>` to your pages that tells AI agents where to find clean Markdown versions. When someone pastes your URL into ChatGPT or Claude, the AI reads the rendered text and can follow the hint to get better content.

Dynamic per-check suggestions (e.g., "Add llms.txt", "Fix noindex on homepage") are planned for a future release.

---

## AI Bot Traffic — Detailed Methodology

The "AI bot traffic" check makes real HTTP requests using **7 AI bot User-Agent strings** against the homepage and up to 2 randomly selected sample pages (21 total requests).

**User-Agents tested:**
1. `GPTBot` (OpenAI's web crawler)
2. `ChatGPT-User` (OpenAI's user-agent for ChatGPT actions)
3. `ClaudeBot` (Anthropic's web crawler)
4. `Claude-Web` (Anthropic's web user-agent)
5. `Google-Extended` (Google's AI training crawler)
6. `PerplexityBot` (Perplexity's web crawler)
7. `Perplexity-User` (Perplexity's user-agent)

**Block detection criteria:**
- **HTTP status code** — Any response with status 401 (Unauthorized), 403 (Forbidden), or 429 (Too Many Requests) is treated as a block.
- **Content pattern matching** — If the response body is unusually short for the requested page and matches common WAF/CDN block page patterns (e.g., containing "blocked", "access denied", "challenge", "verify your browser", CAPTCHA-related content), it's treated as a block even if the status code is 200.

**Scoring:** Each page gets a pass/fail per User-Agent. A page passes if all 7 User-Agents receive real content. The overall check passes if 0 out of 21 requests are blocked.
