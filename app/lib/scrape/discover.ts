import parseHTMLTree, { getElementsByTagName } from "~/lib/html/parseHTML";

const MEDIA_EXTENSIONS = /\.(pdf|jpg|jpeg|png|gif|svg|webp|mp4|mp3|zip|exe)$/i;

export type DiscoveryResult = {
  urls: string[];
  disallowedPaths: Set<string>;
};

export async function discoverUrls({
  domain,
  homepageHtml,
  signal,
}: {
  domain: string;
  homepageHtml: string;
  signal: AbortSignal;
}): Promise<DiscoveryResult> {
  const base = `https://${domain}`;
  const probe = () => AbortSignal.any([signal, AbortSignal.timeout(3_000)]);
  const tree = parseHTMLTree(homepageHtml);

  const [llmsUrls, disallowedPaths, sitemapUrls, rssUrls] = await Promise.all([
    fetchLlmsTxt(base, probe()),
    fetchRobotsTxt(base, probe()),
    fetchSitemapUrls(base, domain, tree, probe()),
    fetchRssUrls(base, domain, tree, probe()),
  ]);

  const navUrls = extractNavUrls({ domain, tree });

  const all = dedup([...llmsUrls, ...sitemapUrls, ...rssUrls, ...navUrls]);
  const filtered = all.filter((url) => !isDisallowed(url, disallowedPaths));

  return { urls: filtered, disallowedPaths };
}

async function fetchLlmsTxt(base: string, signal: AbortSignal): Promise<string[]> {
  try {
    const res = await fetch(`${base}/llms.txt`, { signal });
    if (!res.ok) return [];
    const text = await res.text();
    return text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /^https?:\/\//.test(l));
  } catch {
    return [];
  }
}

async function fetchRobotsTxt(base: string, signal: AbortSignal): Promise<Set<string>> {
  try {
    const res = await fetch(`${base}/robots.txt`, { signal });
    if (!res.ok) return new Set();
    const text = await res.text();
    const disallowed = new Set<string>();
    for (const line of text.split("\n")) {
      const match = line.match(/^Disallow:\s*(.+)/i);
      if (match?.[1]) disallowed.add(match[1].trim());
    }
    return disallowed;
  } catch {
    return new Set();
  }
}

async function fetchSitemapUrls(
  base: string,
  domain: string,
  tree: ReturnType<typeof parseHTMLTree>,
  signal: AbortSignal,
): Promise<string[]> {
  const links = getElementsByTagName(tree, "link");

  let hintedSitemapUrl: string | null = null;
  for (const link of links) {
    if (link.attributes.rel === "sitemap" && link.attributes.href) {
      hintedSitemapUrl = new URL(link.attributes.href, base).href;
      break;
    }
  }

  const txtUrl = hintedSitemapUrl?.endsWith(".txt") ? hintedSitemapUrl : `${base}/sitemap.txt`;
  const txtResult = await tryFetchSitemapTxt(txtUrl, domain, signal);
  if (txtResult.length > 0) return txtResult;

  const xmlUrl = hintedSitemapUrl?.endsWith(".xml") ? hintedSitemapUrl : `${base}/sitemap.xml`;
  return tryFetchSitemapXml(xmlUrl, domain, signal);
}

async function tryFetchSitemapTxt(
  url: string,
  domain: string,
  signal: AbortSignal,
): Promise<string[]> {
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return [];
    const text = await res.text();
    return text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => {
        if (!/^https?:\/\//.test(l)) return false;
        try {
          const u = new URL(l);
          return u.hostname === domain && !MEDIA_EXTENSIONS.test(u.pathname);
        } catch {
          return false;
        }
      });
  } catch {
    return [];
  }
}

async function tryFetchSitemapXml(
  url: string,
  domain: string,
  signal: AbortSignal,
): Promise<string[]> {
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return [];
    const xml = await res.text();
    const locs: string[] = [];
    const locRegex = /<loc>(.*?)<\/loc>/g;
    let match = locRegex.exec(xml);
    while (match !== null) {
      const u = match[1]?.trim();
      if (u) {
        try {
          const parsed = new URL(u);
          if (parsed.hostname === domain && !MEDIA_EXTENSIONS.test(parsed.pathname))
            locs.push(u);
        } catch {}
      }
      match = locRegex.exec(xml);
    }
    return locs;
  } catch {
    return [];
  }
}

async function fetchRssUrls(
  base: string,
  domain: string,
  tree: ReturnType<typeof parseHTMLTree>,
  signal: AbortSignal,
): Promise<string[]> {
  try {
    const links = getElementsByTagName(tree, "link");
    let feedUrl: string | null = null;
    for (const link of links) {
      const type = link.attributes.type ?? "";
      if (type.includes("rss") || type.includes("atom")) {
        feedUrl = link.attributes.href ? new URL(link.attributes.href, base).href : null;
        break;
      }
    }
    if (!feedUrl) return [];

    const res = await fetch(feedUrl, { signal });
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

    const urls: string[] = [];
    for (const u of [...rssLinks, ...atomLinks]) {
      try {
        const parsed = new URL(u);
        if (parsed.hostname === domain) urls.push(u);
      } catch {}
    }
    return urls;
  } catch {
    return [];
  }
}

function extractNavUrls({
  domain,
  tree,
}: {
  domain: string;
  tree: ReturnType<typeof parseHTMLTree>;
}): string[] {
  const navs = getElementsByTagName(tree, "nav");
  const anchors =
    navs.length > 0
      ? navs.flatMap((nav) => getElementsByTagName(nav.children, "a"))
      : getElementsByTagName(tree, "a");

  const seen = new Set<string>();
  const urls: string[] = [];

  for (const anchor of anchors) {
    const href = anchor.attributes.href;
    if (!href || href.startsWith("#") || href.startsWith("mailto:")) continue;
    if (MEDIA_EXTENSIONS.test(href)) continue;
    let url: URL;
    try {
      url = new URL(href.startsWith("http") ? href : `https://${domain}${href}`);
    } catch {
      continue;
    }
    if (url.hostname !== domain) continue;
    if (url.pathname === "/" || url.pathname === "") continue;
    const depth = url.pathname.split("/").filter(Boolean).length;
    if (depth > 3) continue;
    const key = url.origin + url.pathname;
    if (seen.has(key)) continue;
    seen.add(key);
    urls.push(url.href);
  }

  return urls;
}

function isDisallowed(url: string, disallowedPaths: Set<string>): boolean {
  try {
    const { pathname } = new URL(url);
    for (const pattern of disallowedPaths)
      if (pathname.startsWith(pattern)) return true;
  } catch {}
  return false;
}

function dedup(urls: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
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
