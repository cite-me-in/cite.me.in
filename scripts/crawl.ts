#!/usr/bin/env tsx

/**
 * Use this to crawl a website and return the content:
 *
 * ./scripts/crawl.ts <url> [maxPages]
 */

import { crawl } from "../app/lib/scrape/crawl";

const url = process.argv[2];
if (!url) {
  console.error("Usage: ./scripts/crawl.ts <domain> [maxPages] [maxWords]");
  process.exit(1);
}

const content = await crawl({
  baseURL: new URL(url, "https://example.com").href,
  maxPages: 20,
  maxWords: 5_000,
});
console.info(content);
