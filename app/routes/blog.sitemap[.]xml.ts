import { recentBlogPosts } from "~/lib/blogPosts.server";

export async function loader() {
  const posts = await recentBlogPosts();

  const urls = posts
    .map(
      ({ slug, published }) => `
  <url>
    <loc>${new URL(`/blog/${slug}`, import.meta.env.VITE_APP_URL).toString()}</loc>
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
