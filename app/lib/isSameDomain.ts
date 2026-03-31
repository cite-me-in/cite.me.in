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
