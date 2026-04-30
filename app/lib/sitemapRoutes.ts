import { XMLParser } from "fast-xml-parser";

const localRoutes = [
  "/",
  "/faq",
  "/about",
  "/privacy",
  "/terms",
  "/docs",
  "/pricing",
  "/try",
  "/visibility-score",
].map((path) => new URL(path, process.env.VITE_APP_URL).toString());

/**
 * Get the list of all the routes that should be included in the sitemap. This
 * includes the local routes and the routes from blog.cite.me.in.
 *
 * @returns A list of all the routes that should be included in the sitemap.
 */
export default async function getSitemapRoutes(): Promise<string[]> {
  const blogURLs = await processSitemap(
    "https://blog.cite.me.in/sitemap-index.xml",
  );
  return [...localRoutes, ...blogURLs];
}

async function processSitemap(url: string): Promise<string[]> {
  const xml = await fetchXML(url);
  if (!xml) return [];

  const parser = new XMLParser();
  const parsed = parser.parse(xml) as
    | { sitemapindex: { sitemap: { loc: string } } }
    | { urlset: { url: { loc: string }[] } };

  if ("sitemapindex" in parsed) {
    const urls = await processSitemap(parsed.sitemapindex.sitemap.loc);
    return urls.flat();
  } else return parsed.urlset.url.map((url) => url.loc);
}

async function fetchXML(url: string): Promise<string | null> {
  const response = await fetch(url);
  if (!response.ok) return null;
  return await response.text();
}
