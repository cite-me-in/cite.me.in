import { ms } from "convert";
import debug from "debug";
import captureAndLogError from "~/lib/captureAndLogError.server";
import parseHTMLTree, { getElementsByTagName } from "~/lib/html/parseHTML";
import { isSameDomain, normalizeDomain } from "~/lib/isSameDomain";

const MEDIA_EXTENSIONS = /\.(pdf|jpg|jpeg|png|gif|svg|webp|mp4|mp3|zip|exe)$/i;

const logger = debug("crawl");

/**
 * Discovers URLs from the given domain. Looks at robots.txt, sitemap.txt,
 * sitemap.xml, and RSS/Atom feeds. Also looks at nav links in the homepage
 * HTML. Only returns URLs that are on the same domain as the base URL.
 *
 * @param baseURL - The base URL of the domain to discover URLs from.
 * @param homepage - The HTML of the homepage.
 * @param signal - The abort signal to use to cancel the discovery.
 * @returns The discovered URLs and the disallowed URLs.
 */
export default async function discoverURLs({
  url,
  homepage,
  signal,
}: {
  url: URL;
  homepage: string;
  signal: AbortSignal;
}): Promise<URL[]> {
  const { hostname } = new URL(url);
  const probe = () => AbortSignal.any([signal, AbortSignal.timeout(ms("3s"))]);
  const tree = parseHTMLTree(homepage);

  const [sitemapURLs, rssURLs] = await Promise.all([
    fetchSitemapURLs(url, tree, probe()),
    fetchRSS(url, tree, probe()),
  ]);
  const navURLs = extractNavURLs({ baseURL: url, tree });
  const urls = dedup([...sitemapURLs, ...rssURLs, ...navURLs]).filter((url) =>
    isSameDomain({ domain: hostname, url }),
  );
  logger("[crawl] Discovered %s => %d URLs", hostname, urls.length);

  return urls;
}

/**
 * Fetches the sitemap.txt or sitemap.xml file from the homepage HTML and
 * returns a list of URLs from it.
 *
 * @param baseURL - The base URL of the domain to fetch sitemap URLs from.
 * @param tree - The HTML tree of the homepage.
 * @param signal - The abort signal to use to cancel the fetch.
 * @returns A list of URLs from the sitemap.
 */
async function fetchSitemapURLs(
  baseURL: URL,
  tree: ReturnType<typeof parseHTMLTree>,
  signal: AbortSignal,
): Promise<URL[]> {
  const links = getElementsByTagName(tree, "link");

  const url = links.find(
    (link) => link.attributes.rel === "sitemap" && link.attributes.href,
  )?.attributes.href;
  if (!url) return [];

  try {
    if (url?.endsWith(".txt")) {
      const response = await fetch(new URL(url, baseURL), { signal });
      if (!response.ok) return [];
      const text = await response.text();
      logger("[crawl] Fetched %s: %d sitemap URLs", url, text.length);
      return text
        .split("\n")
        .map((link) => normalizeDomain(link.trim()))
        .map((link) => new URL(link, baseURL));
    } else {
      const response = await fetch(new URL(url, baseURL), { signal });
      if (!response.ok) return [];
      const xml = await response.text();
      const urls = await parseSitemapXML({ xml, baseURL });
      logger("[crawl] Fetched %s: %d sitemap URLs", url, urls.length);
      return urls;
    }
  } catch (error) {
    captureAndLogError(
      `Error fetching sitemap URLs: ${error instanceof Error ? error.message : String(error)}`,
      {
        extra: { url },
      },
    );
    return [];
  }
}

/**
 * Parses the XML of the sitemap and returns a list of URLs from it.
 *
 * @param xml - The XML of the sitemap.
 * @param domain - The domain of the URLs in the sitemap.
 * @returns A list of URLs from the sitemap.
 */
async function parseSitemapXML({
  xml,
  baseURL,
}: {
  xml: string;
  baseURL: URL;
}): Promise<URL[]> {
  const locs: URL[] = [];
  const locRegex = /<loc>(.*?)<\/loc>/g;
  let match = locRegex.exec(xml);
  while (match !== null) {
    const url = match[1]?.trim();
    if (url) locs.push(new URL(url, baseURL));
    match = locRegex.exec(xml);
  }
  return locs;
}

/**
 * Fetches the RSS/Atom feed link from the homepage HTML and returns a list of
 * URLs from it.
 *
 * @param baseURL - The base URL of the domain to fetch RSS/Atom feed from.
 * @param tree - The HTML tree of the homepage.
 * @param signal - The abort signal to use to cancel the fetch.
 * @returns A list of URLs from the RSS/Atom feed.
 */
async function fetchRSS(
  baseURL: URL,
  tree: ReturnType<typeof parseHTMLTree>,
  signal: AbortSignal,
): Promise<URL[]> {
  const links = getElementsByTagName(tree, "link");
  const url = links.find(
    (link) =>
      link.attributes.type?.includes("rss") ||
      link.attributes.type?.includes("atom"),
  )?.attributes.href;
  if (!url) return [];

  try {
    const res = await fetch(new URL(url, baseURL), { signal });
    if (!res.ok) return [];

    const xml = await res.text();
    const rssLinks: string[] = [];
    const rssRegex = /<link>(.*?)<\/link>/g;
    let rssMatch = rssRegex.exec(xml);
    while (rssMatch !== null) {
      const u = rssMatch[1]?.trim();
      if (u) rssLinks.push(u);
      rssMatch = rssRegex.exec(xml);
    }

    const atomLinks: string[] = [];
    const atomRegex = /<link[^>]+href="([^"]+)"[^>]*\/>/g;
    let atomMatch = atomRegex.exec(xml);
    while (atomMatch !== null) {
      const u = atomMatch[1]?.trim();
      if (u) atomLinks.push(u);
      atomMatch = atomRegex.exec(xml);
    }

    const urls = [...rssLinks, ...atomLinks].map(
      (url) => new URL(url, baseURL),
    );
    logger("[crawl] Fetched %s: %d RSS/Atom URLs", url, urls.length);
    return urls;
  } catch (error) {
    captureAndLogError(
      `Error fetching RSS: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { extra: { url } },
    );
    return [];
  }
}

/**
 * Extracts the navigation anchor `href`s from the homepage HTML and returns a list of
 * URLs from them.
 *
 * @param baseURL - The base URL of the domain to extract navigation anchor `href`s from.
 * @param tree - The HTML tree of the homepage.
 * @returns A list of navigation anchor `href`s, deduplicated and filtered
 * against the disallowed URLs, normalized to the base URL.
 */
function extractNavURLs({
  baseURL,
  tree,
}: {
  baseURL: URL;
  tree: ReturnType<typeof parseHTMLTree>;
}): URL[] {
  const navs = getElementsByTagName(tree, "nav");
  const anchors =
    navs.length > 0
      ? navs.flatMap((nav) => getElementsByTagName(nav.children, "a"))
      : getElementsByTagName(tree, "a");

  const urls = anchors
    .map((anchor) => {
      const href = anchor.attributes.href;
      if (!href || href.startsWith("#") || href.startsWith("mailto:"))
        return null;
      if (MEDIA_EXTENSIONS.test(href)) return null;
      return new URL(href, baseURL);
    })
    .filter((url) => url !== null);
  logger("[crawl] Extracted %d navigation anchor `href`s", urls.length);
  return urls;
}

function dedup(urls: URL[]): URL[] {
  const seen = new Set<string>();
  const result: URL[] = [];
  for (const url of urls) {
    try {
      const { origin, pathname } = new URL(url);
      const key = origin + pathname.replace(/\/$/, "");
      if (!seen.has(key)) {
        seen.add(key);
        result.push(url);
      }
    } catch {}
  }
  return result;
}
