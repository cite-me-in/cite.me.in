#!/usr/bin/env tsx

/**
 * Use this to crawl a website and return the content:
 *
 * pnpm run crawl <url> [maxPages]
 */

import { extractDomain, fetchSiteContent } from "../app/lib/sites.server";

const url = process.argv[2];
if (!url) {
  console.error("Usage: ./scripts/crawl.ts <domain> [maxPages] [maxWords]");
  process.exit(1);
}

const domain = extractDomain(url);
if (!domain) {
  console.error("Invalid domain: %s", url);
  process.exit(1);
}

const maxPages = process.argv[3] ? Number.parseInt(process.argv[3], 10) : 5;

const content = await fetchSiteContent({
  domain,
  maxPages,
  maxWords: 5_000,
});
console.info(content);
