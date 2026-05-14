/**
 * Validate a domain input. Returns an object with a boolean indicating if the
 * input is valid and an optional error message. Valid inputs are:
 * - A complete URL (e.g., https://yourwebsite.com?utm_source=openai)
 * - A domain name (e.g., yourwebsite.com)
 *
 * Invalid if the input is not a complete URL or a domain name, no TLD, IP
 * address, localhost, or reserved domain.
 *
 * @param input - The input to validate.
 * @returns An object with a boolean indicating if the input is valid and an optional error message.
 */
export function validateDomainInput(input: string): {
  valid: boolean;
  error?: string;
} {
  const trimmed = input.trim();

  if (!trimmed) return { valid: false, error: "Enter a website URL" };

  // Check for incomplete URLs (protocol without domain, or just slashes)
  // Matches: "http://", "https://", "http:/// ", "///", etc.
  const incompletePattern = /^https?:\/\/\s*$|^https?:\/\/\/+\s*$|^\/+\s*$/;
  if (incompletePattern.test(trimmed)) {
    return {
      valid: false,
      error: "Enter a complete URL (e.g., yourwebsite.com)",
    };
  }

  // Check for localhost or IP addresses
  const localhostPattern = /localhost|127\.0\.0\.1|0\.0\.0\.0|:\d+/i;
  if (localhostPattern.test(trimmed)) return { valid: false, error: "Enter a public website URL" };

  // Extract domain using URL parsing (same approach as server)
  const domain = extractDomain(trimmed);
  if (!domain) {
    return {
      valid: false,
      error: "Enter a valid domain (e.g., yourwebsite.com)",
    };
  }

  // Check for valid TLD (dot followed by at least 2 characters)
  if (!/\.[a-zA-Z]{2,}$/.test(domain)) {
    return {
      valid: false,
      error: "Enter a valid domain (e.g., yourwebsite.com)",
    };
  }

  return { valid: true };
}

function extractDomain(input: string): string | null {
  // Try parsing as-is first (handles full URLs like "https://example.com/path")
  try {
    const url = new URL(input);
    return url.hostname;
  } catch {
    // Not a valid URL, try adding https://
  }

  // Try adding https:// (handles "example.com/path" or "example.com")
  try {
    const url = new URL(`https://${input}`);
    return url.hostname;
  } catch {
    // Invalid URL even with protocol
    return null;
  }
}
