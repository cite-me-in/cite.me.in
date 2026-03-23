type DomainMeta = { brandName: string; url: string };
type CacheEntry = DomainMeta & { fetchedAt: number };

const cache = new Map<string, CacheEntry>();
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function getDomainMeta(domain: string): Promise<DomainMeta> {
  const cached = cache.get(domain);
  if (cached && Date.now() - cached.fetchedAt < TTL_MS)
    return { brandName: cached.brandName, url: cached.url };

  try {
    const res = await fetch(`https://${domain}`, {
      signal: AbortSignal.timeout(3000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; cite.me.in/1.0)" },
    });
    const canonicalUrl = res.url;
    const html = await res.text();
    const brandName = extractBrandName(html) ?? prettifyDomain(domain);
    const meta = { brandName, url: canonicalUrl };
    cache.set(domain, { ...meta, fetchedAt: Date.now() });
    return meta;
  } catch {
    const meta = { brandName: prettifyDomain(domain), url: `https://${domain}` };
    cache.set(domain, { ...meta, fetchedAt: Date.now() });
    return meta;
  }
}

function extractBrandName(html: string): string | null {
  const ogMatch =
    html.match(
      /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i,
    ) ??
    html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i,
    );
  if (ogMatch) return ogMatch[1].trim();

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    const trimmed = titleMatch[1]
      .trim()
      .replace(/\s*[-|—]\s*.+$/, "")
      .trim();
    return trimmed || null;
  }
  return null;
}

function prettifyDomain(domain: string): string {
  const name = domain.replace(/\.[^.]+$/, "");
  // Replace separators with spaces only when the following segment has >1 char
  const spaced = name.replace(/[-_](?=\w{2,})/g, " ");
  return spaced.replace(/(^|\s)\w/g, (c) => c.toUpperCase());
}
