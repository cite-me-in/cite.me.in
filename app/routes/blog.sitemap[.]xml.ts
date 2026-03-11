import { recentBlogPosts } from "~/lib/blogPosts.server";
import envVars from "~/lib/envVars";

export async function loader() {
  const posts = await recentBlogPosts();

  const urls = posts
    .map(
      ({ slug, published }) => `
  <url>
    <loc>${envVars.APP_URL}/blog/${slug}</loc>
    <lastmod>${published.toISOString().split("T")[0]}</lastmod>
  </url>`,
    )
    .join("");

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}
</urlset>`;

  return new Response(sitemap, {
    headers: { "Content-Type": "application/xml" },
  });
}
