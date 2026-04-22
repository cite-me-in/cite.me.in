import { generateSitemap } from "@forge42/seo-tools/sitemap";

export async function loader() {
  const lastmod = new Date().toISOString();
  const sitemap = await generateSitemap({
    domain: import.meta.env.VITE_APP_URL,
    routes: routes.map((url) => ({ url, lastmod })),
  });
  return new Response(sitemap, {
    headers: { "Content-Type": "application/xml" },
  });
}

const routes = [
  "/",
  "/faq",
  "/about",
  "/privacy",
  "/terms",
  "/docs",
  "/pricing",
  "/visibility-score",
];
