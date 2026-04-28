import type { CheckDetail } from "./types";

const checkDetails: Record<string, CheckDetail> = {
  "robots.txt": {
    goal: "Allow AI crawlers to access your site so they can index and cite your content",
    issue:
      "AI agents like GPTBot, ClaudeBot, and PerplexityBot respect robots.txt directives. If they find a Disallow: / rule for their user-agent, they will not crawl your site, and your content won't appear in AI-generated answers.",
    howToImplement:
      "Add Allow: / rules for known AI bot user-agents (GPTBot, ClaudeBot, PerplexityBot, etc.) above any Disallow rules. Place these rules before any catch-all User-agent: * Disallow to ensure they take effect. If your robots.txt uses a blanket Disallow: /, the AI bots will never crawl your content and it won't appear in AI-generated answers.",
    fixExample:
      "User-agent: GPTBot\nAllow: /\n\nUser-agent: ClaudeBot\nAllow: /\n\nUser-agent: PerplexityBot\nAllow: /\n\nUser-agent: *\nDisallow: /private/",
    effort: "2 min",
    skillUrl: "https://skills.sh/kostja94/marketing-skills/robots-txt",
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
    auditSteps: [
      {
        label: "Fetch /robots.txt",
        value: "GET /robots.txt — check response status and content type",
      },
      {
        label: "Parse user-agent groups",
        value: "Identify each User-agent block and its Allow/Disallow rules",
      },
      {
        label: "Check AI bot rules",
        value:
          "Look for Disallow: / under GPTBot, ClaudeBot, PerplexityBot, etc.",
      },
      {
        label: "Verify ordering",
        value:
          "AI bot rules must appear before any catch-all User-agent: * Disallow",
      },
    ],
  },
  "sitemap.xml": {
    goal: "Provide a complete XML sitemap so AI crawlers can discover all your pages",
    issue:
      "AI agents use sitemaps to find pages beyond the homepage. Without a valid sitemap.xml, deep pages may never be discovered or cited.",
    howToImplement:
      "Create /sitemap.xml following the sitemaps.org protocol. List every important page with its <loc> and optional <lastmod>. Serve with Content-Type: application/xml or text/xml. Reference it from robots.txt via a Sitemap directive, add an HTML <link rel='sitemap'> tag in your <head>, and set an HTTP Link header for redundant discovery paths.",
    fixExample:
      '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>https://example.com/</loc>\n    <lastmod>2025-01-01</lastmod>\n  </url>\n  <url>\n    <loc>https://example.com/about</loc>\n  </url>\n  <url>\n    <loc>https://example.com/products</loc>\n  </url>\n</urlset>\n\n# robots.txt reference:\nSitemap: https://example.com/sitemap.xml\n\n# HTML <head>:\n<link rel="sitemap" type="application/xml" href="/sitemap.xml">\n\n# HTTP header:\nLink: </sitemap.xml>; rel=sitemap; type=application/xml',
    effort: "15 min",
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
    auditSteps: [
      {
        label: "Fetch /sitemap.xml",
        value: "GET /sitemap.xml — check HTTP 200 and Content-Type header",
      },
      {
        label: "Parse XML",
        value: "Parse as XML and validate against sitemaps.org schema",
      },
      {
        label: "Extract URLs",
        value: "Collect all <loc> values and validate they are absolute URLs",
      },
      {
        label: "Check count",
        value: "Verify at least one valid URL exists in the sitemap",
      },
    ],
  },
  "Homepage content": {
    goal: "Return rich HTML content from your homepage without requiring JavaScript execution",
    issue:
      'AI agents do not execute JavaScript. If your homepage is an SPA shell (empty <div id="root"> or <div id="app">) with minimal text content, AI agents see a blank page and cannot cite your content.',
    howToImplement:
      "Add server-side rendered (SSR) content to your homepage HTML. If you use a JavaScript framework, either enable SSR or inject a <noscript> or hidden <nav> element containing links and descriptive text. AI agents don't execute JavaScript. Ensure at least 100 characters of meaningful text exist in the raw HTML so agents see content instead of an empty SPA shell.",
    fixExample:
      '<!-- If you can\'t enable SSR, inject a hidden navigation block: -->\n<noscript>\n  <nav>\n    <a href="/about">About us</a>\n    <a href="/products">Our products</a>\n    <a href="/contact">Contact</a>\n  </nav>\n</noscript>\n<div style="display:none">\n  <!-- Fallback content for AI crawlers -->\n  <p>Welcome to our site. We offer products, services, and more.</p>\n</div>',
    effort: "1 hour",
    resourceLinks: [
      {
        label: "SPA SEO guide",
        url: "https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics",
      },
    ],
    auditSteps: [
      {
        label: "Fetch homepage",
        value: "GET / — check HTTP 200, no JavaScript execution",
      },
      {
        label: "Strip HTML tags",
        value: "Remove all HTML/script/style tags to isolate text content",
      },
      {
        label: "Measure text length",
        value: "Count remaining characters — must be >= 100",
      },
      {
        label: "Detect SPA shell",
        value: 'Check HTML for <div id="root"> or <div id="app"> patterns',
      },
    ],
  },
  "llms.txt": {
    goal: "Provide an llms.txt file so LLMs have structured guidance about your site's content",
    issue:
      "Without an llms.txt file at /llms.txt, LLMs lack structured context about what content to index, how to prioritize pages, and how to understand your site's structure.",
    howToImplement:
      "Create /llms.txt at your site root following the llms.txt standard. Include a brief site description at the top, followed by sections with links to key pages. Mark optional content with # if you want LLMs to prefer more important pages.",
    fixExample:
      "# Your Site Name\n> Brief description of your site for AI context.\n\n## Featured\n- [Homepage](https://example.com/)\n- [About us](https://example.com/about)\n\n## Blog\n- [Latest post](https://example.com/blog/latest)\n# [Archived posts](https://example.com/blog/archive)\n\n## Resources\n- [Documentation](https://docs.example.com/)",
    effort: "15 min",
    skillUrl: "https://skills.sh/github/awesome-copilot/create-llms",
    resourceLinks: [
      {
        label: "llms.txt spec",
        url: "https://llmstxt.org/",
      },
    ],
    auditSteps: [
      {
        label: "Fetch /llms.txt",
        value: "GET /llms.txt — check HTTP 200 with Content-Type: text/plain",
      },
      {
        label: "Check content",
        value:
          "Verify the file contains a site description and at least one link",
      },
      {
        label: "Validate format",
        value:
          "Check for optional sections, comments (#), and valid URL format",
      },
    ],
  },
  "sitemap.txt": {
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
    auditSteps: [
      {
        label: "Fetch /sitemap.txt",
        value: "GET /sitemap.txt — check HTTP 200 and Content-Type header",
      },
      {
        label: "Validate URLs",
        value: "Test each line with new URL() — must be absolute, valid URLs",
      },
      { label: "Check minimum", value: "Verify at least one valid URL exists" },
    ],
  },
  "Sample pages": {
    goal: "Ensure pages listed in your sitemap return real content, not empty shells",
    issue:
      "Pages in your sitemap might return empty SPA shells, error pages, or have minimal content. AI agents cannot cite pages that have no meaningful text content.",
    howToImplement:
      "Audit a sample of up to 10 pages from your sitemap. Each page must return HTTP 200 with at least 100 characters of visible text in the raw HTML. Avoid client-side-only rendering for key pages by adding SSR or static generation.",
    fixExample:
      "# Example: Node.js audit script\nimport { readFile } from 'fs/promises'\n\nconst sitemap = await fetch('https://example.com/sitemap.xml')\nconst urls = [...sitemap.body.matchAll(/<loc>([^<]+)<\\/loc>/g)].map(m => m[1])\n\nfor (const url of urls.slice(0, 10)) {\n  const res = await fetch(url)\n  const html = await res.text()\n  const text = html.replace(/<style[^>]*>[^<]*<\\/style>/gi, '')\n    .replace(/<script[^>]*>[^<]*<\\/script>/gi, '')\n    .replace(/<[^>]+>/g, '')\n  console.log(url, res.status, text.length >= 100 ? 'PASS' : 'FAIL')\n}",
    effort: "15 min",
    resourceLinks: [],
    auditSteps: [
      {
        label: "Sample selection",
        value: "Pick up to 10 unique URLs from your sitemaps",
      },
      {
        label: "Fetch each page",
        value: "GET each URL — no JavaScript, check HTTP 200",
      },
      {
        label: "Check content",
        value: "Verify each page has at least 100 characters of visible text",
      },
      {
        label: "Detect SPA shells",
        value:
          'Check each page for <div id="root"> or <div id="app"> without content',
      },
    ],
  },
  "JSON-LD": {
    goal: "Add structured data so AI agents can accurately categorize and cite your content",
    issue:
      "Without JSON-LD structured data, AI agents have limited context about your organization, content type, and relationships. This can lead to incorrect or incomplete citations.",
    howToImplement:
      "Add JSON-LD structured data to your HTML <head> using schema.org types. Common types include Organization, WebSite, Article, and BreadcrumbList. Each type has required fields — for example, Organization needs name and url; WebSite needs name and url; Article needs headline and author. This helps AI agents understand and accurately cite your content.",
    fixExample:
      '<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "Organization",\n  "name": "Your Company",\n  "url": "https://example.com",\n  "description": "Description of your organization"\n}\n</script>\n\n<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "WebSite",\n  "name": "Your Site",\n  "url": "https://example.com"\n}\n</script>',
    effort: "15 min",
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
    auditSteps: [
      {
        label: "Find JSON-LD blocks",
        value: "Search HTML for <script type='application/ld+json'>",
      },
      {
        label: "Parse each block",
        value: "Parse JSON and flatten @graph arrays",
      },
      {
        label: "Validate schema types",
        value:
          "Check against 12 known schema types (Article, Organization, etc.)",
      },
      {
        label: "Check required fields",
        value: "Verify fields like name, headline, url are present",
      },
    ],
  },
  "Meta tags": {
    goal: "Provide meta description and Open Graph tags so AI agents can format accurate citations",
    issue:
      "Without meta description and Open Graph tags, AI agents lack the rich context needed for high-quality citations and social previews.",
    howToImplement:
      "Add a <meta name='description'> tag with a concise page summary, <meta property='og:title'> and <meta property='og:description'> for rich previews, and <link rel='canonical'> to prevent duplicate content confusion.",
    fixExample:
      '<head>\n  <meta name="description" content="Brief summary of your page for AI agents and search engines">\n  <meta property="og:title" content="Your Page Title">\n  <meta property="og:description" content="Social preview description">\n  <meta property="og:image" content="https://example.com/og-image.png">\n  <link rel="canonical" href="https://example.com/page">\n</head>',
    effort: "5 min",
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
    auditSteps: [
      {
        label: "Find meta description",
        value: "Search HTML for <meta name='description'> with content",
      },
      {
        label: "Find OG tags",
        value: "Search for <meta property='og:title'> and og:description",
      },
      {
        label: "Find canonical",
        value: "Search for <link rel='canonical'> with a valid href",
      },
    ],
  },
  "Link headers": {
    goal: "Provide sitemap references via Link response headers and HTML link tags so AI agents can discover all your content",
    issue:
      "AI agents need direct signals to find your sitemaps. Without Link headers or HTML <link rel='sitemap'> tags, agents may miss your sitemaps entirely, even if referenced in robots.txt.",
    howToImplement:
      "Add a Link header to your HTTP response: Link: </sitemap.xml>; rel=sitemap. Also add <link rel='sitemap' type='application/xml' href='/sitemap.xml'> to your HTML <head>. These provide redundant discovery paths for different AI agents.",
    fixExample:
      '# HTTP response header:\nLink: </sitemap.xml>; rel=sitemap; type=application/xml\nLink: </sitemap.txt>; rel=sitemap; type=text/plain\n\n# HTML <head>:\n<link rel="sitemap" type="application/xml" title="XML Sitemap" href="/sitemap.xml">\n<link rel="sitemap" type="text/plain" title="Text Sitemap" href="/sitemap.txt">',
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
    auditSteps: [
      {
        label: "Check HTTP Link header",
        value: "HEAD / — look for Link header containing 'sitemap'",
      },
      {
        label: "Check HTML link tag",
        value: "Scan <head> for <link rel='sitemap'> tag",
      },
    ],
  },
  "Markdown content negotiation": {
    goal: "Support markdown content negotiation so AI agents can consume your content in their preferred format",
    issue:
      "AI agents strongly prefer markdown over HTML. Without supporting Accept: text/markdown, agents must parse your HTML and extract content, which can lead to lower-quality citations or missed content.",
    howToImplement:
      "Configure your server to detect Accept: text/markdown headers and respond with a markdown version of your pages. Cloudflare, Vercel, and other platforms support this via middleware. Return Content-Type: text/markdown with the markdown body on successful negotiation.",
    fixExample:
      "# Example: Cloudflare Workers middleware\naddEventListener('fetch', event => {\n  event.respondWith(handleRequest(event.request))\n})\n\nasync function handleRequest(request) {\n  const accept = request.headers.get('Accept')\n  if (accept && accept.includes('text/markdown')) {\n    const html = await fetch(request)\n    const markdown = convertHtmlToMarkdown(await html.text())\n    return new Response(markdown, {\n      headers: { 'Content-Type': 'text/markdown' }\n    })\n  }\n  return fetch(request)\n}",
    resourceLinks: [
      {
        label: "Cloudflare Markdown for Agents",
        url: "https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/",
      },
    ],
    auditSteps: [
      {
        label: "Request with Accept: text/markdown",
        value: "GET / with Accept: text/markdown header",
      },
      {
        label: "Check response",
        value: "Verify Content-Type starts with text/markdown or text/plain",
      },
      {
        label: "Validate content",
        value: "Ensure response body has at least 50 characters of content",
      },
    ],
  },
  "Content Signals": {
    goal: "Provide a Content-Signature header so AI agents can verify your content is authentic and unmodified",
    issue:
      "Without a Content-Signature header, AI agents have no cryptographic proof that your content is authentic. This can reduce trust in your citations compared to sites that provide content provenance signals.",
    howToImplement:
      "Generate a Content-Signature header using the emerging standard (see Cloudflare Content Signals). This provides cryptographic verification that your content hasn't been tampered with, increasing trust with AI agents that check for it.",
    resourceLinks: [
      {
        label: "Cloudflare Content Signals",
        url: "https://blog.cloudflare.com/content-signals/",
      },
    ],
    auditSteps: [
      {
        label: "Check Content-Signature header",
        value: "HEAD / — look for Content-Signature response header",
      },
    ],
  },
};

export default checkDetails;
