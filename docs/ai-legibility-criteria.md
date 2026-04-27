# AI Legibility Criteria

AI legibility measures how easily AI agents (ChatGPT, Claude, Gemini, Perplexity, etc.) can discover, read, and understand a website's content.

The space lacks a single canonical standard — these criteria synthesize established web standards, AI crawler documentation, and emerging practices.

## Tier Definitions

### Critical — Gates AI Discovery

If these fail, AI crawlers may be blocked entirely or find nothing to index. These are **hard requirements** for any site that wants AI visibility.

| Check | Why it's critical | Reference |
|-------|------------------|-----------|
| **robots.txt** | Controls whether AI crawlers are allowed on your site at all. A missing or misconfigured robots.txt can block every major AI crawler (GPTBot, ClaudeBot, Google-Extended, etc.). | [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309) |
| **sitemap.xml** | The canonical sitemap format that most crawlers use to discover pages. Required for comprehensive indexing. | [sitemaps.org](https://www.sitemaps.org/protocol.html) |
| **Homepage content** | If the homepage returns an empty SPA shell (no server-side rendering), AI agents see nothing. Many AI crawlers don't execute JavaScript. | Common knowledge among AI crawler docs (e.g., [Google's rendering policy](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)) |

### Important — Improves Discovery Quality

These substantially improve how much content AI agents can find and how well they understand it. They're strong signals that differentiate indexed from well-indexed.

| Check | Why it's important | Reference |
|-------|-------------------|-----------|
| **llms.txt** | A direct signal to LLMs about what content to index. While optional, it's the most AI-specific discovery mechanism available. | [llmstxt.org](https://llmstxt.org/) |
| **sitemap.txt** | A plain-text alternative to XML sitemaps. Useful as a supplement but less structured than XML. | Community convention |
| **Sample pages have content** | Confirms that pages listed in sitemaps actually return real content (not empty shells, login walls, or errors). | Common sense |
| **Meta tags** | Title and description tags help AI agents summarize and cite your content correctly. | [HTML spec](https://html.spec.whatwg.org/multipage/semantics.html#the-meta-element) |

### Optimization — Enhances Presentation

These add structured context or improve how content appears in citations, but aren't needed for discovery or basic understanding.

| Check | Why it's optimization | Reference |
|-------|----------------------|-----------|
| **JSON-LD / Schema.org** | Adds explicit semantic structure. Helps AI agents understand entity relationships but isn't needed to read your content. | [schema.org](https://schema.org/) |
| **Open Graph tags** | Controls how content appears in social previews and some AI chat responses. Presentation, not substance. | [ogp.me](https://ogp.me/) |
| **Canonical URLs** | Helps prevent duplicate content confusion but doesn't affect initial discovery. | [RFC 6596](https://www.rfc-editor.org/rfc/rfc6596) |

## Guiding Principle

Each tier represents a **dependency layer**:

```
Critical  →  "Can AI agents reach and read my content?"
Important →  "Can AI agents find all my content and understand what it's about?"
Optimize  →  "Does my content present well when cited?"
```

A site that passes all critical and important checks will be well-indexed by AI agents even without any optimization checks passing. The reverse is not true — perfect JSON-LD won't help if robots.txt blocks all crawlers.
