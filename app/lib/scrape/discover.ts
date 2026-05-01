import { ms } from "convert";
import debug from "debug";
import { parseHTML } from "linkedom";
import captureAndLogError from "~/lib/captureAndLogError.server";
import { isSameDomain, normalizeDomain } from "~/lib/isSameDomain";

const MEDIA_EXTENSIONS = /\.(pdf|jpg|jpeg|png|gif|svg|webp|mp4|mp3|zip|exe)$/i;

const logger = debug("crawl");

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
  const doc = parseHTML(homepage).document;

  const [sitemapURLs, rssURLs] = await Promise.all([
    fetchSitemapURLs(url, doc, probe()),
    fetchRSS(url, doc, probe()),
  ]);
  const navURLs = extractNavURLs({ baseURL: url, doc });
  const urls = dedup([...sitemapURLs, ...rssURLs, ...navURLs]).filter((url) =>
    isSameDomain({ domain: hostname, url }),
  );
  logger("[crawl] Discovered %s => %d URLs", hostname, urls.length);

  return urls;
}

async function fetchSitemapURLs(
  baseURL: URL,
  doc: Document,
  signal: AbortSignal,
): Promise<URL[]> {
  const link = doc.querySelector('link[rel="sitemap"]');
  const url = link?.getAttribute("href");
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
    const locUrl = match[1]?.trim();
    if (locUrl) locs.push(new URL(locUrl, baseURL));
    match = locRegex.exec(xml);
  }
  return locs;
}

async function fetchRSS(
  baseURL: URL,
  doc: Document,
  signal: AbortSignal,
): Promise<URL[]> {
  const link = doc.querySelector('link[type*="rss"], link[type*="atom"]');
  const url = link?.getAttribute("href");
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

    const urls = [...rssLinks, ...atomLinks].map((u) => new URL(u, baseURL));
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

function extractNavURLs({
  baseURL,
  doc,
}: {
  baseURL: URL;
  doc: Document;
}): URL[] {
  const navs = doc.querySelectorAll("nav");
  const anchors =
    navs.length > 0
      ? [...navs].flatMap((nav) => [...nav.querySelectorAll("a")])
      : [...doc.querySelectorAll("a")];

  const urls = anchors
    .map((anchor) => {
      const href = anchor.getAttribute("href");
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
