type MockResponse = {
  ok: boolean;
  status?: number;
  headers: { get: (name: string) => string | null };
  text: () => Promise<string>;
};

type FixtureMap = Record<string, MockResponse>;

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

const LLMS_TXT = `# Acme Corp LLM Context
https://acme.com/about
https://acme.com/pricing
`;

const ROBOTS_TXT = `User-agent: *
Disallow: /admin/
Disallow: /private/
`;

const SITEMAP_TXT = `https://acme.com/about
https://acme.com/pricing
https://acme.com/blog
https://acme.com/blog/post-1
`;

const SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://acme.com/about</loc></url>
  <url><loc>https://acme.com/pricing</loc></url>
  <url><loc>https://acme.com/blog/post-1</loc></url>
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

export function mockFetch(responses: FixtureMap) {
  return async (
    url: string | URL,
    _init?: RequestInit,
  ): Promise<MockResponse> => {
    const key = url.toString();
    return responses[key] ?? notFound();
  };
}

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

export function sitemapXmlSite(): FixtureMap {
  return {
    "https://acme.com/": html(
      HOMEPAGE_HTML.replace('href="/sitemap.txt"', 'href="/sitemap.xml"'),
    ),
    "https://acme.com/llms.txt": notFound(),
    "https://acme.com/robots.txt": notFound(),
    "https://acme.com/sitemap.txt": notFound(),
    "https://acme.com/sitemap.xml": html(SITEMAP_XML, "application/xml"),
    "https://acme.com/about": html(HTML_MAIN_CONTENT),
    "https://acme.com/pricing": html(HTML_MAIN_CONTENT),
  };
}

export function navOnlySite(): FixtureMap {
  const homepageNoSitemap = HOMEPAGE_HTML.replace(
    '<link rel="sitemap" href="/sitemap.txt" />',
    "",
  ).replace(
    '<link rel="alternate" type="application/rss+xml" href="/feed.xml" />',
    "",
  );
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
