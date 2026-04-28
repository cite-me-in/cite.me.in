import type { CheckDetail } from "./types";

const checkDetails: Record<string, CheckDetail> = {
  "robots.txt": {
    goal: "Allow AI crawlers to access your site so they can index and cite your content",
    issue:
      "AI agents like GPTBot, ClaudeBot, and PerplexityBot respect robots.txt directives. If they find a Disallow: / rule for their user-agent, they will not crawl your site, and your content won't appear in AI-generated answers.",
    howToImplement:
      "Add Allow: / rules for known AI bot user-agents above any Disallow rules, or remove Disallow: / lines that target these bots. Place the rules before any catch-all Disallow to ensure they take effect.",
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
      "Create /sitemap.xml following the sitemaps.org protocol. List every important page with its <loc> and optional <lastmod>. Serve with Content-Type: application/xml or text/xml. Reference it from robots.txt via a Sitemap directive.",
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
      "Add server-side rendered (SSR) content to your homepage HTML. If you use a JavaScript framework, either enable SSR or inject a <noscript> or hidden <nav> element containing links and descriptive text. Ensure at least 100 characters of meaningful text exist in the raw HTML.",
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
      "Create /sitemap.txt with one absolute URL per line listing all important pages. Reference it from robots.txt via a Sitemap directive. Serve with Content-Type: text/plain.",
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
      "Add a <script type='application/ld+json'> block to your HTML <head> with schema.org types such as Organization, WebSite, Article, BreadcrumbList, or Product. Validate all required fields are present (e.g., name, headline, url).",
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
};

export default checkDetails;
