type DomainMeta = { brandName: string; url: string };
type CacheEntry = DomainMeta & { fetchedAt: number };

const cache = new Map<string, CacheEntry>();
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Clear the domain meta cache.
 */
export function clearDomainMetaCache(): void {
  cache.clear();
}

/**
 * Get the meta data for a domain. Specifically, the brand name and URL.
 *
 * @param domain - The domain to get the meta data for.
 * @returns The brand name and URL for the domain.
 */
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
    const brandName = decodeEntities(extractBrandName(html) ?? prettifyDomain(domain));
    const meta = { brandName, url: canonicalUrl };
    cache.set(domain, { ...meta, fetchedAt: Date.now() });
    return meta;
  } catch {
    const meta = {
      brandName: prettifyDomain(domain),
      url: `https://${domain}`,
    };
    cache.set(domain, { ...meta, fetchedAt: Date.now() });
    return meta;
  }
}

function extractBrandName(html: string): string | null {
  const ogMatch =
    html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i);
  if (ogMatch) return ogMatch[1].trim();

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    return titleMatch[1]
      .trim()
      .replace(/\s*[-|—]\s*.+$/, "")
      .trim();
  }
  return null;
}

function prettifyDomain(domain: string): string {
  const name = domain.replace(/\.[^.]+$/, "");
  // Replace separators with spaces only when the following segment has >1 char
  const spaced = name.replace(/[-_](?=\w{2,})/g, " ");
  return spaced.replace(/(^|\s)\w/g, (c) => c.toUpperCase());
}

// Decode HTML entities in the extracted brand/title string
function decodeEntities(text: string): string {
  // Handle common HTML entities (&amp;, &lt;, &gt;, &quot;, &#39;, etc.)
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([A-Fa-f0-9]+);/g, (_, n) => String.fromCharCode(Number.parseInt(n, 16)));
}
