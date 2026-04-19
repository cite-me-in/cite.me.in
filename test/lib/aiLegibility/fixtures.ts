type MockResponse = {
  ok: boolean;
  status: number;
  headers: { get: (name: string) => string | null };
  text: () => Promise<string>;
};

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

export function mockFetch(responses: Record<string, MockResponse>) {
  return async (url: string | URL): Promise<MockResponse> => {
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

export const ROBOTS_EMPTY = ``;

export const SITEMAP_TXT = `https://acme.com/
https://acme.com/about
https://acme.com/pricing
https://acme.com/blog
`;

export const SITEMAP_TXT_INVALID = `Not a URL
Also not a URL
`;

export const SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://acme.com/</loc></url>
  <url><loc>https://acme.com/about</loc></url>
  <url><loc>https://acme.com/pricing</loc></url>
</urlset>`;

export const SITEMAP_XML_INVALID = `<?xml version="1.0" encoding="UTF-8"?>
<invalid>Not a valid sitemap</invalid>`;

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

export const LLMS_TXT = `# Acme Corp LLM Context

This is the main documentation for Acme Corp.

## Products
- Product A
- Product B
`;

export function passingSite(): Record<string, MockResponse> {
  return {
    "https://acme.com/": html(HOMEPAGE_WITH_CONTENT),
    "https://acme.com/robots.txt": html(ROBOTS_TXT, "text/plain"),
    "https://acme.com/sitemap.txt": html(SITEMAP_TXT, "text/plain"),
    "https://acme.com/sitemap.xml": html(SITEMAP_XML, "application/xml"),
    "https://acme.com/llms.txt": html(LLMS_TXT, "text/plain"),
  };
}

export function failingSite(): Record<string, MockResponse> {
  return {
    "https://acme.com/": html(HOMEPAGE_SPA_SHELL),
    "https://acme.com/robots.txt": notFound(),
    "https://acme.com/sitemap.txt": notFound(),
    "https://acme.com/sitemap.xml": notFound(),
    "https://acme.com/llms.txt": notFound(),
  };
}

export function partialSite(): Record<string, MockResponse> {
  return {
    "https://acme.com/": html(HOMEPAGE_WITH_CONTENT),
    "https://acme.com/robots.txt": html(ROBOTS_TXT, "text/plain"),
    "https://acme.com/sitemap.txt": notFound(),
    "https://acme.com/sitemap.xml": html(SITEMAP_XML, "application/xml"),
    "https://acme.com/llms.txt": notFound(),
  };
}
