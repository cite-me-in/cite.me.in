# AI Legibility Criteria

AI legibility measures how easily AI agents (ChatGPT, Claude, Gemini, Perplexity, etc.) can discover, read, and understand a website's content. Our scanner evaluates sites against 16 checks organized into three categories:

**Discovered** — "Can AI agents find all my content?"
Checks sitemaps (XML, TXT), llms.txt, link headers, and Markdown alternate links. If AI agents can't discover your pages, nothing else matters.

**Trusted** — "Does my content present well when cited?"
Checks page content, sample pages, meta tags, Markdown content negotiation, and `.md` routes. Real content with proper metadata ensures accurate citation.

**Welcomed** — "Are AI crawlers allowed on my site?"
Checks robots.txt, noindex directives, Content Signals, JSON-LD, and real AI bot traffic (7 User-Agent strings). Even discoverable content is invisible if crawlers are blocked.

See [ai-legibility-checker.md](./ai-legibility-checker.md) for full check specifications, execution order, effort estimation, and output format.
