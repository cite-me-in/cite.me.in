import type { CheckDetail } from "./types";

type CheckDef = {
  name: string;
  desc: string;
  detail: CheckDetail;
};

type Category = {
  key: "discovered" | "trusted" | "welcomed";
  title: string;
  color: string;
  gaugeColor: string;
  emailColor: string;
  description: string;
  checks: CheckDef[];
};

const CATEGORIES: Category[] = [
  {
    key: "discovered",
    title: "Discovered",
    color: "text-blue-600",
    gaugeColor: "#3b82f6",
    emailColor: "#2563eb",
    description: "Can AI agents find all my content?",
    checks: [
      {
        name: "sitemap.xml",
        desc: "The canonical sitemap format most crawlers use",
        detail: {
          goal: "Provide a complete XML sitemap so AI crawlers can discover all your pages",
          issue:
            "AI agents use sitemaps to find pages beyond the homepage. Without a valid sitemap.xml, deep pages may never be discovered or cited.",
          howToImplement:
            "Create /sitemap.xml following the sitemaps.org protocol. List every important page with its <loc> and optional <lastmod>. Serve with Content-Type: application/xml or text/xml. Reference it from robots.txt via a Sitemap directive, add an HTML <link rel='sitemap'> tag in your <head>, and set an HTTP Link header for redundant discovery paths.",
          fixExample:
            '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>https://example.com/</loc>\n    <lastmod>2025-01-01</lastmod>\n  </url>\n  <url>\n    <loc>https://example.com/about</loc>\n  </url>\n  <url>\n    <loc>https://example.com/products</loc>\n  </url>\n</urlset>\n\n# robots.txt reference:\nSitemap: https://example.com/sitemap.xml\n\n# HTML <head>:\n<link rel="sitemap" type="application/xml" href="/sitemap.xml">\n\n# HTTP header:\nLink: </sitemap.xml>; rel=sitemap; type=application/xml',
          effort: "15 min",
          skillURL: "https://skills.sh/coreyhaines31/marketingskills/seo-audit",
          resourceLinks: [
            {
              label: "Sitemaps protocol",
              url: "https://www.sitemaps.org/protocol.html",
            },
            {
              label: "Google sitemap guide",
              url: "https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview",
            },
          ],
        },
      },
      {
        name: "sitemap.txt",
        desc: "Plain-text supplement to XML sitemaps",
        detail: {
          goal: "Provide a plain-text sitemap as a lightweight alternative for AI discovery",
          issue:
            "Without a text sitemap, some AI agents may not efficiently discover all your pages. Text sitemaps are simpler than XML and easier for agents to parse.",
          howToImplement:
            "Create /sitemap.txt with one absolute URL per line listing all important pages on your site. This is the single most impactful change for AI discoverability. Make it discoverable by referencing it from robots.txt, your HTML, or HTTP Link headers. Serve with Content-Type: text/plain.",
          fixExample:
            '# robots.txt — add a Sitemap line:\nSitemap: https://example.com/sitemap.txt\n\n# HTML <head> — add a link tag:\n<link rel="sitemap" type="text/plain" title="Sitemap" href="/sitemap.txt">\n\n# HTTP header — add a Link header:\nLink: </sitemap.txt>; rel=sitemap; type=text/plain\n\n# sitemap.txt content:\nhttps://example.com/\nhttps://example.com/about\nhttps://example.com/products',
          effort: "5 min",
          resourceLinks: [
            {
              label: "About text sitemaps",
              url: "https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap#text",
            },
          ],
        },
      },
      {
        name: "llms.txt",
        desc: "Direct signal to LLMs about what content to index",
        detail: {
          goal: "Provide an llms.txt file so LLMs have structured guidance about your site's content",
          issue:
            "Without an llms.txt file at /llms.txt, LLMs lack structured context about what content to index, how to prioritize pages, and how to understand your site's structure.",
          howToImplement:
            "Create /llms.txt at your site root following the llms.txt standard. Include a brief site description at the top, followed by sections with links to key pages. Mark optional content with # if you want LLMs to prefer more important pages.",
          fixExample:
            "# Your Site Name\n> Brief description of your site for AI context.\n\n## Featured\n- [Homepage](https://example.com/)\n- [About us](https://example.com/about)\n\n## Blog\n- [Latest post](https://example.com/blog/latest)\n# [Archived posts](https://example.com/blog/archive)\n\n## Resources\n- [Documentation](https://docs.example.com/)",
          effort: "15 min",
          skillURL: "https://skills.sh/github/awesome-copilot/create-llms",
          resourceLinks: [
            {
              label: "llms.txt spec",
              url: "https://llmstxt.org/",
            },
          ],
        },
      },
      {
        name: "Link headers",
        desc: "HTTP Link headers and HTML link tags pointing to sitemaps",
        detail: {
          goal: "Provide sitemap references via Link response headers and HTML link tags so AI agents can discover all your content",
          issue:
            "AI agents need direct signals to find your sitemaps. Without Link headers or HTML <link rel='sitemap'> tags, agents may miss your sitemaps entirely, even if referenced in robots.txt.",
          howToImplement:
            "Add a Link header to your HTTP response: Link: </sitemap.xml>; rel=sitemap. Also add <link rel='sitemap' type='application/xml' href='/sitemap.xml'> to your HTML <head>. These provide redundant discovery paths for different AI agents.",
          fixExample:
            '# HTTP response header:\nLink: </sitemap.xml>; rel=sitemap; type=application/xml\nLink: </sitemap.txt>; rel=sitemap; type=text/plain\n\n# HTML <head>:\n<link rel="sitemap" type="application/xml" title="XML Sitemap" href="/sitemap.xml">\n<link rel="sitemap" type="text/plain" title="Text Sitemap" href="/sitemap.txt">',
          effort: "5 min",
          skillURL: "https://skills.sh/squirrelscan/skills/audit-website",
          resourceLinks: [
            {
              label: "Link header (MDN)",
              url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Link",
            },
            {
              label: "Sitemap discovery",
              url: "https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview#other",
            },
          ],
        },
      },
      {
        name: "Markdown alternate links",
        desc: "Alternate link tags advertising Markdown versions",
        detail: {
          goal: "Advertise Markdown versions of your pages via HTML <link> tags and HTTP Link headers",
          issue:
            "AI agents that don't parse HTML body (e.g., autonomous agents, coding assistants) can still discover Markdown versions through HTTP headers. Without these signals, agents may never find your .md routes.",
          howToImplement:
            'Add <link rel="alternate" type="text/markdown" href="/page.md"> to your HTML <head> and a Link: </page.md>; rel="alternate"; type="text/markdown" HTTP header. The HTML tag catches crawlers that process the DOM. The HTTP header catches headless fetchers that don\'t.',
          fixExample:
            '# HTTP response header:\nLink: </index.md>; rel="alternate"; type="text/markdown"\n\n# HTML <head>:\n<link rel="alternate" type="text/markdown" title="Markdown version" href="/index.md">',
          effort: "5 min",
          resourceLinks: [
            {
              label: "Evil Martians LLM visibility guide",
              url: "https://evilmartians.com/chronicles/how-to-make-your-website-visible-to-llms",
            },
          ],
        },
      },
    ],
  },
  {
    key: "trusted",
    title: "Trusted",
    color: "text-purple-600",
    gaugeColor: "#9333ea",
    emailColor: "#9333ea",
    description: "Does my content present well when cited?",
    checks: [
      {
        name: "Homepage content",
        desc: "Homepage returns real content, not an empty SPA shell",
        detail: {
          goal: "Return rich HTML content from your homepage without requiring JavaScript execution",
          issue:
            'AI agents do not execute JavaScript. If your homepage is an SPA shell (empty <div id="root"> or <div id="app">) with minimal text content, AI agents see a blank page and cannot cite your content.',
          howToImplement:
            "Add server-side rendered (SSR) content to your homepage HTML. If you use a JavaScript framework, either enable SSR or inject a <noscript> or hidden <nav> element containing links and descriptive text. AI agents don't execute JavaScript. Ensure at least 100 characters of meaningful text exist in the raw HTML so agents see content instead of an empty SPA shell.",
          fixExample:
            '<!-- If you can\'t enable SSR, inject a hidden navigation block: -->\n<noscript>\n  <nav>\n    <a href="/about">About us</a>\n    <a href="/products">Our products</a>\n    <a href="/contact">Contact</a>\n  </nav>\n</noscript>\n<div style="display:none">\n  <!-- Fallback content for AI crawlers -->\n  <p>Welcome to our site. We offer products, services, and more.</p>\n</div>',
          effort: "1 hour",
          skillURL: "https://skills.sh/coreyhaines31/marketingskills/ai-seo",
          resourceLinks: [
            {
              label: "SPA SEO guide",
              url: "https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics",
            },
          ],
        },
      },
      {
        name: "Sample pages",
        desc: "Pages in your sitemap return real content",
        detail: {
          goal: "Ensure pages listed in your sitemap return real content, not empty shells",
          issue:
            "Pages in your sitemap might return empty SPA shells, error pages, or have minimal content. AI agents cannot cite pages that have no meaningful text content.",
          howToImplement:
            "Audit a sample of up to 10 pages from your sitemap. Each page must return HTTP 200 with at least 100 characters of visible text in the raw HTML. Avoid client-side-only rendering for key pages by adding SSR or static generation.",
          fixExample:
            "# Example: Node.js audit script\nimport { readFile } from 'fs/promises'\n\nconst sitemap = await fetch('https://example.com/sitemap.xml')\nconst urls = [...sitemap.body.matchAll(/<loc>([^<]+)<\\/loc>/g)].map(m => m[1])\n\nfor (const url of urls.slice(0, 10)) {\n  const res = await fetch(url)\n  const html = await res.text()\n  const text = html.replace(/<style[^>]*>[^<]*<\\/style>/gi, '')\n    .replace(/<script[^>]*>[^<]*<\\/script>/gi, '')\n    .replace(/<[^>]+>/g, '')\n  console.log(url, res.status, text.length >= 100 ? 'PASS' : 'FAIL')\n}",
          effort: "15 min",
          skillURL: "https://skills.sh/squirrelscan/skills/audit-website",
          resourceLinks: [],
        },
      },
      {
        name: "Meta tags",
        desc: "Title and description for summaries",
        detail: {
          goal: "Provide meta description and Open Graph tags so AI agents can format accurate citations",
          issue:
            "Without meta description and Open Graph tags, AI agents lack the rich context needed for high-quality citations and social previews.",
          howToImplement:
            "Add a <meta name='description'> tag with a concise page summary, <meta property='og:title'> and <meta property='og:description'> for rich previews, and <link rel='canonical'> to prevent duplicate content confusion.",
          fixExample:
            '<head>\n  <meta name="description" content="Brief summary of your page for AI agents and search engines">\n  <meta property="og:title" content="Your Page Title">\n  <meta property="og:description" content="Social preview description">\n  <meta property="og:image" content="https://example.com/og-image.png">\n  <link rel="canonical" href="https://example.com/page">\n</head>',
          effort: "5 min",
          skillURL: "https://skills.sh/coreyhaines31/marketingskills/seo-audit",
          resourceLinks: [
            {
              label: "Open Graph protocol",
              url: "https://ogp.me/",
            },
            {
              label: "Meta tags guide",
              url: "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta",
            },
          ],
        },
      },
      {
        name: "Markdown content negotiation",
        desc: "Serves markdown when AI agents request it",
        detail: {
          goal: "Support markdown content negotiation so AI agents can consume your content in their preferred format",
          issue:
            "AI agents strongly prefer markdown over HTML. Without supporting Accept: text/markdown, agents must parse your HTML and extract content, which can lead to lower-quality citations or missed content.",
          howToImplement:
            "Configure your server to detect Accept: text/markdown headers and respond with a markdown version of your pages. Cloudflare, Vercel, and other platforms support this via middleware. Return Content-Type: text/markdown with the markdown body on successful negotiation.",
          fixExample:
            "# Example: Cloudflare Workers middleware\naddEventListener('fetch', event => {\n  event.respondWith(handleRequest(event.request))\n})\n\nasync function handleRequest(request) {\n  const accept = request.headers.get('Accept')\n  if (accept && accept.includes('text/markdown')) {\n    const html = await fetch(request)\n    const markdown = convertHtmlToMarkdown(await html.text())\n    return new Response(markdown, {\n      headers: { 'Content-Type': 'text/markdown' }\n    })\n  }\n  return fetch(request)\n}",
          effort: "1 hour",
          resourceLinks: [
            {
              label: "Cloudflare Markdown for Agents",
              url: "https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/",
            },
          ],
        },
      },
      {
        name: ".md routes",
        desc: "Clean Markdown versions of pages at .md URLs",
        detail: {
          goal: "Provide a clean Markdown version of each page at the same URL with .md appended",
          issue:
            "When AI agents or users paste your URL into ChatGPT/Claude, the model has to parse HTML to extract content. A .md route serves clean Markdown directly — reducing token count by ~80% and eliminating navigation/script noise.",
          howToImplement:
            "Serve a Markdown version of every page at {path}.md. For the homepage, serve /index.md or /page.md (where /page is the homepage path). Use Content-Type: text/markdown. If your content is authored in Markdown, serve the source directly. If in a CMS, convert on the fly.",
          fixExample:
            '# Route handler for /blog/:slug\napp.get("/blog/:slug.md", (req, res) => {\n  const post = getPost(req.params.slug)\n  res.type("text/markdown").send(post.markdownContent)\n})',
          effort: "1 hour",
          resourceLinks: [
            {
              label: "Making agent-friendly pages (Vercel)",
              url: "https://vercel.com/blog/making-agent-friendly-pages-with-content-negotiation",
            },
          ],
        },
      },
    ],
  },
  {
    key: "welcomed",
    title: "Welcomed",
    color: "text-emerald-600",
    gaugeColor: "#059669",
    emailColor: "#059669",
    description: "Are AI crawlers allowed on my site?",
    checks: [
      {
        name: "robots.txt",
        desc: "Controls whether AI crawlers are allowed on your site",
        detail: {
          goal: "Allow AI crawlers to access your site so they can index and cite your content",
          issue:
            "AI agents like GPTBot, ClaudeBot, and PerplexityBot respect robots.txt directives. If they find a Disallow: / rule for their user-agent, they will not crawl your site, and your content won't appear in AI-generated answers.",
          howToImplement:
            "Add Allow: / rules for known AI bot user-agents (GPTBot, ClaudeBot, PerplexityBot, etc.) above any Disallow rules. Place these rules before any catch-all User-agent: * Disallow to ensure they take effect. If your robots.txt uses a blanket Disallow: /, the AI bots will never crawl your content and it won't appear in AI-generated answers.",
          fixExample:
            "User-agent: GPTBot\nAllow: /\n\nUser-agent: ClaudeBot\nAllow: /\n\nUser-agent: PerplexityBot\nAllow: /\n\nUser-agent: *\nDisallow: /private/",
          effort: "2 min",
          skillURL: "https://skills.sh/coreyhaines31/marketingskills/ai-seo",
          resourceLinks: [
            {
              label: "About robots.txt",
              url: "https://developers.google.com/search/docs/crawling-indexing/robots/intro",
            },
            {
              label: "AI bot list",
              url: "https://darkvisitors.com/",
            },
          ],
        },
      },
      {
        name: "Content Signals",
        desc: "Content-Signal declaration in robots.txt for content usage permissions",
        detail: {
          goal: "Declare a Content-Signal in your robots.txt so AI agents know whether they can use your content",
          issue:
            "Without a Content-Signal directive in robots.txt, AI agents have no signal about whether they may collect, process, or train on your content. Adding one gives you control and clarity.",
          howToImplement:
            "Add a `Content-Signal` directive to your robots.txt file. The directive can appear as a comment or as a field following the pattern: Content-Signal: search=yes, ai-input=yes, ai-train=no. Each key controls a different use: search (indexing for search results), ai-input (real-time AI retrieval/grounding), and ai-train (model training).",
          fixExample:
            "# robots.txt\n\nUser-agent: *\nAllow: /\n\n# Declare content usage signals:\nContent-Signal: search=yes, ai-input=yes, ai-train=no\n\nSitemap: https://example.com/sitemap.xml",
          effort: "5 min",
          skillURL: "https://skills.sh/coreyhaines31/marketingskills/ai-seo",
          resourceLinks: [
            {
              label: "About Content-Signal",
              url: "https://www.content-signature.org/",
            },
          ],
        },
      },
      {
        name: "JSON-LD",
        desc: "Structured data for entity understanding",
        detail: {
          goal: "Add structured data so AI agents can accurately categorize and cite your content",
          issue:
            "Without JSON-LD structured data, AI agents have limited context about your organization, content type, and relationships. This can lead to incorrect or incomplete citations.",
          howToImplement:
            "Add JSON-LD structured data to your HTML <head> using schema.org types. Common types include Organization, WebSite, Article, and BreadcrumbList. Each type has required fields — for example, Organization needs name and url; WebSite needs name and url; Article needs headline and author. This helps AI agents understand and accurately cite your content.",
          fixExample:
            '<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "Organization",\n  "name": "Your Company",\n  "url": "https://example.com",\n  "description": "Description of your organization"\n}\n</script>\n\n<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "WebSite",\n  "name": "Your Site",\n  "url": "https://example.com"\n}\n</script>',
          effort: "15 min",
          skillURL:
            "https://skills.sh/coreyhaines31/marketingskills/schema-markup",
          resourceLinks: [
            {
              label: "Schema.org",
              url: "https://schema.org/",
            },
            {
              label: "Google structured data guide",
              url: "https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data",
            },
          ],
        },
      },
    ],
  },
];

export function getCheckDetail(name: string): CheckDetail | undefined {
  for (const category of CATEGORIES) {
    const check = category.checks.find((c) => c.name === name);
    if (check) return check.detail;
  }
  return undefined;
}

export function getCheckCategory(name: string): string | undefined {
  for (const category of CATEGORIES) {
    if (category.checks.some((c) => c.name === name)) return category.key;
  }
  return undefined;
}

export default CATEGORIES;
