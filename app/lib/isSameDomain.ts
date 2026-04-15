/**
 * Check if a URL is on the same domain as a given domain. The domain can be
 * provided with or without the "www." prefix. For example:
 * - "cite.me.in" is the same as "https://www.cite.me.in"
 * - "cite.me.in" is the same as "https://cite.me.in"
 * - "cite.me.in" is the same as "https://www.cite.me.in/about"
 *
 * @param domain - The domain to check against.
 * @param url - The URL to check, or a string URL.
 * @returns True if the URL is on the same domain as the given domain, false otherwise.
 */
export function isSameDomain({
  domain,
  url,
}: {
  domain: string;
  url: string | URL;
}): boolean {
  try {
    const { hostname } = url instanceof URL ? url : new URL(url);
    return (
      hostname.toLowerCase() === domain.toLowerCase() ||
      hostname.toLowerCase().replace(/^www\./, "") === domain.toLowerCase()
    );
  } catch {
    return false;
  }
}

/**
 * Check if a URL is an exact match for a domain, including subdomains.
 * For example, for domain "zoehong.com":
 * - "zoehong.com" → true (exact match)
 * - "www.zoehong.com" → true (www prefix)
 * - "shop.zoehong.com" → true (subdomain)
 * - "zoehong.substack.com" → false (different root domain)
 *
 * @param domain - The domain to check against.
 * @param url - The URL to check.
 * @returns True if the URL is an exact match (same domain or subdomain).
 */
export function isExactDomain({
  domain,
  url,
}: {
  domain: string;
  url: string | URL;
}): boolean {
  try {
    const { hostname } = url instanceof URL ? url : new URL(url);
    const normalizedHostname = hostname.toLowerCase();
    const normalizedDomain = domain.toLowerCase();

    if (normalizedHostname === normalizedDomain) return true;
    if (normalizedHostname === `www.${normalizedDomain}`) return true;
    if (normalizedHostname.endsWith(`.${normalizedDomain}`)) return true;

    return false;
  } catch {
    return false;
  }
}

/**
 * Normalize a hostname or URL to a lowercase hostname without the "www." prefix. For example:
 * - "www.cite.me.in" -> "cite.me.in"
 * - "cite.me.in" -> "cite.me.in"
 * - "https://www.cite.me.in/about" -> "cite.me.in"
 *
 * @param input - The hostname or URL to normalize.
 * @returns The normalized hostname or an empty string if the input is not a valid URL.
 */
export function normalizeDomain(input: string | URL): string {
  try {
    const url =
      input instanceof URL
        ? input
        : /^https?:\/\//.test(input)
          ? new URL(input)
          : new URL(`https://${input}`);
    const hostname = url.hostname.toLowerCase();
    return hostname.startsWith("www.") ? hostname.slice(4) : hostname;
  } catch {
    return "";
  }
}

/**
 * Normalize a URL by removing UTM tracking parameters and trailing slash on root paths.
 * For example:
 * - "https://example.com/?utm_source=openai" -> "https://example.com"
 * - "https://example.com/page?utm_medium=email" -> "https://example.com/page"
 *
 * @param url - The URL to normalize.
 * @returns The normalized URL or the original string if invalid.
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete("utm_source");
    parsed.searchParams.delete("utm_medium");
    parsed.searchParams.delete("utm_campaign");
    parsed.searchParams.delete("utm_term");
    parsed.searchParams.delete("utm_content");
    if (parsed.pathname === "/" && parsed.search === "") {
      return parsed.origin;
    }
    return parsed.origin + parsed.pathname + parsed.search;
  } catch {
    return url;
  }
}
