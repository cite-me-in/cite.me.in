import getSitemapRoutes from "~/lib/sitemapRoutes";

export async function loader() {
  const lastmod = new Date().toISOString();
  const urls = await getSitemapRoutes();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${urls
    .map(
      (url) => `
    <url>
      <loc>${url}</loc>
      <lastmod>${lastmod}</lastmod>
    </url>`,
    )
    .join("")}
</urlset>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml" },
  });
}
