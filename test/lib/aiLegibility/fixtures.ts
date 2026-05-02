function text(
  body: string,
  contentType = "text/html",
): { body: string; contentType: string; status: number } {
  return { body, contentType, status: 200 };
}

function notFound(): { body: string; contentType: string; status: number } {
  return { body: "", contentType: "text/plain", status: 404 };
}

type MockResponse = {
  ok: boolean;
  status?: number;
  headers: { get: (name: string) => string | null };
  text: () => Promise<string>;
};

type FixtureMap = Record<string, MockResponse>;

export function mockFetch(responses: FixtureMap) {
  return async (
    url: string | URL,
    _init?: RequestInit,
  ): Promise<MockResponse> => {
    const key = url.toString();
    return responses[key] ?? notFound();
  };
}

export const HOMEPAGE_WITH_CONTENT = `<!DOCTYPE html>
<html>
<head>
  <title>Acme Corp</title>
  <meta name="description" content="Acme Corp builds great software">
  <meta property="og:title" content="Acme Corp">
  <meta property="og:type" content="website">
  <meta property="og:image" content="https://acme.com/og.png">
  <meta property="og:url" content="https://acme.com/">
  <meta property="og:description" content="We build great software">
  <link rel="canonical" href="https://acme.com/">
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"Organization","name":"Acme Corp","url":"https://acme.com"}
  </script>
</head>
<body>
  <main>
    <h1>Welcome to Acme</h1>
    <p>We make great software products for businesses all around the world. Our team is dedicated to delivering quality solutions.</p>
  </main>
</body>
</html>`;

export const HOMEPAGE_SPA_SHELL = `<!DOCTYPE html>
<html>
<head>
  <title>SPA App</title>
</head>
<body>
  <div id="root"></div>
  <script src="/app.js"></script>
</body>
</html>`;

export const HOMEPAGE_EMPTY_BODY = `<!DOCTYPE html>
<html>
<head>
  <title>Empty Page</title>
</head>
<body>
</body>
</html>`;

export const ROBOTS_TXT = `User-agent: *
Disallow: /admin/
Disallow: /private/
Sitemap: https://acme.com/sitemap.xml
`;

export const ROBOTS_TXT_WITH_SIGNAL = `User-agent: *
Disallow: /admin/
Disallow: /private/

Content-Signal: search=yes, ai-input=yes, ai-train=no

Sitemap: https://acme.com/sitemap.xml
`;

export const ROBOTS_EMPTY = "";

export const ROBOTS_TXT_BLOCKS_AI = `User-agent: *
Disallow: /admin/

User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: CCBot
Disallow: /

Sitemap: https://acme.com/sitemap.xml
`;

export const ROBOTS_TXT_PARTIAL_AI_BLOCK = `User-agent: *
Disallow: /admin/

User-agent: GPTBot
Disallow: /private/

User-agent: ClaudeBot
Allow: /public/

Sitemap: https://acme.com/sitemap.xml
`;

export const ROBOTS_TXT_AI_ALLOWED = `User-agent: *
Disallow: /admin/

User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

Sitemap: https://acme.com/sitemap.xml
`;

export const SITEMAP_TXT = `https://acme.com
https://acme.com/about
https://acme.com/pricing
https://acme.com/blog
`;

export const SITEMAP_TXT_INVALID = `Not a URL
Also not a URL
`;

export const SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://acme.com</loc></url>
  <url><loc>https://acme.com/about</loc></url>
  <url><loc>https://acme.com/pricing</loc></url>
</urlset>`;

export const SITEMAP_XML_INVALID = `<?xml version="1.0" encoding="UTF-8"?>
<invalid>Not a valid sitemap</invalid>`;

export const SITEMAP_INDEX_XML = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://acme.com/sitemap-1.xml</loc></sitemap>
  <sitemap><loc>https://acme.com/sitemap-2.xml</loc></sitemap>
</sitemapindex>`;

export const CHILD_SITEMAP_1_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://acme.com/page1</loc></url>
  <url><loc>https://acme.com/page2</loc></url>
</urlset>`;

export const CHILD_SITEMAP_2_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://acme.com/page3</loc></url>
</urlset>`;

export const JSON_LD_ARTICLE = `<!DOCTYPE html>
<html>
<head>
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"Article","headline":"How to Build","author":{"@type":"Person","name":"John"}}
  </script>
</head>
<body><main>Article content</main></body>
</html>`;

export const JSON_LD_MULTIPLE = `<!DOCTYPE html>
<html>
<head>
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"Organization","name":"Acme"}
  </script>
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"WebSite","name":"Acme Site","url":"https://acme.com"}
  </script>
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home"}]}
  </script>
</head>
<body><main>Content</main></body>
</html>`;

export const JSON_LD_INVALID = `<!DOCTYPE html>
<html>
<head>
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"Article"}
  </script>
</head>
<body><main>Content</main></body>
</html>`;

export const JSON_LD_PARSE_ERROR = `<!DOCTYPE html>
<html>
<head>
  <script type="application/ld+json">
  {invalid json}
  </script>
</head>
<body><main>Content</main></body>
</html>`;

export const JSON_LD_GRAPH = `<!DOCTYPE html>
<html>
<head>
  <script type="application/ld+json">
  {"@context":"https://schema.org","@graph":[{"@type":"SoftwareApplication","name":"Acme App","applicationCategory":"BusinessApplication","operatingSystem":"Web"},{"@type":"Organization","name":"Acme Corp","url":"https://acme.com"},{"@type":"WebSite","name":"Acme Site","url":"https://acme.com"},{"@type":"FAQPage","name":"Acme FAQ","mainEntity":[{"@type":"Question","name":"What is Acme?","acceptedAnswer":{"@type":"Answer","text":"Acme is great."}}]}]}
  </script>
</head>
<body><main>Content</main></body>
</html>`;

export const LLMS_TXT = `# Acme Corp

> Acme Corp is a leading provider of software solutions.

## Products
- [Product A](https://acme.com/products/a): Our flagship product
- [Product B](https://acme.com/products/b): Enterprise solution

## Docs
- [Getting Started](https://acme.com/docs/getting-started): Quick start guide
`;

const SAMPLE_PAGE_CONTENT = `<!DOCTYPE html>
<html>
<head>
  <title>Acme Corp</title>
</head>
<body>
  <main>
    <h1>Page Title</h1>
    <p>This page has enough content to pass the sample pages check. We need at least 100 characters of text content here.</p>
  </main>
</body>
</html>`;

const SAMPLE_PAGE_WITH_LD = `<!DOCTYPE html>
<html>
<head>
  <title>Acme Corp</title>
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"WebPage","name":"About Acme"}
  </script>
</head>
<body>
  <main>
    <h1>About Acme</h1>
    <p>This page has enough content to pass the sample pages check. We need at least 100 characters of text content here.</p>
  </main>
</body>
</html>`;

export function passingSite(): Record<
  string,
  {
    body: string;
    contentType?: string;
    status?: number;
    headers?: Record<string, string>;
  }
> {
  return {
    "https://acme.com": {
      body: HOMEPAGE_WITH_CONTENT,
      contentType: "text/plain",
      headers: {
        Link: '</sitemap.xml>; rel="sitemap", </index.md>; rel="alternate"; type="text/markdown"',
      },
    },
    "https://acme.com/robots.txt": text(ROBOTS_TXT_WITH_SIGNAL, "text/plain"),
    "https://acme.com/sitemap.txt": text(SITEMAP_TXT, "text/plain"),
    "https://acme.com/sitemap.xml": text(SITEMAP_XML, "application/xml"),
    "https://acme.com/llms.txt": text(LLMS_TXT, "text/plain"),
    "https://acme.com/index.md": text(
      "# Acme Corp\n\nWelcome to Acme Corp. We build great software products for businesses of all sizes around the world. Our team is dedicated to delivering quality solutions that help our customers succeed.",
      "text/markdown",
    ),
    "https://acme.com/about": text(SAMPLE_PAGE_WITH_LD),
    "https://acme.com/pricing": text(SAMPLE_PAGE_CONTENT),
    "https://acme.com/blog": text(SAMPLE_PAGE_CONTENT),
    "https://acme.com.md": text(
      "# Acme Corp\n\nWelcome to Acme Corp.",
      "text/markdown",
    ),
  };
}

export function failingSite(): Record<
  string,
  {
    body: string;
    contentType?: string;
    status?: number;
    headers?: Record<string, string>;
  }
> {
  return {
    "https://acme.com": text(HOMEPAGE_SPA_SHELL),
    "https://acme.com/robots.txt": notFound(),
    "https://acme.com/sitemap.txt": notFound(),
    "https://acme.com/sitemap.xml": notFound(),
    "https://acme.com/llms.txt": notFound(),
    "https://acme.com.md": notFound(),
  };
}

export function partialSite(): Record<
  string,
  {
    body: string;
    contentType?: string;
    status?: number;
    headers?: Record<string, string>;
  }
> {
  return {
    "https://acme.com": text(HOMEPAGE_WITH_CONTENT),
    "https://acme.com/robots.txt": text(ROBOTS_TXT, "text/plain"),
    "https://acme.com/sitemap.txt": notFound(),
    "https://acme.com/sitemap.xml": text(SITEMAP_XML, "application/xml"),
    "https://acme.com/llms.txt": notFound(),
    "https://acme.com/about": text(SAMPLE_PAGE_CONTENT),
    "https://acme.com/pricing": text(SAMPLE_PAGE_CONTENT),
    "https://acme.com.md": notFound(),
  };
}
