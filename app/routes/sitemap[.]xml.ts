import envVars from "~/lib/envVars.server";

export async function loader() {
  const baseUrl = envVars.VITE_APP_URL;
  const sitemaps = [
    new URL("/sitemap-main.xml", baseUrl).toString(),
    "https://blog.cite.me.in/sitemap-0.xml",
  ];

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...sitemaps.map((loc) => `  <sitemap><loc>${loc}</loc></sitemap>`),
    "</sitemapindex>",
  ].join("\n");

  return new Response(xml, {
    headers: { "Content-Type": "application/xml" },
  });
}
