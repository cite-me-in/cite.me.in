#!/usr/bin/env tsx

/**
 * Use this to crawl a website and return the content:
 *
 * ./scripts/crawl.ts <domain> [maxPages] [maxWords] [maxSeconds]
 */

import { crawl } from "../app/lib/scrape/crawl";

const domain = process.argv[2];
if (!domain) {
  console.error("Usage: ./scripts/crawl.ts <domain> [maxPages] [maxWords] [maxSeconds]");
  process.exit(1);
}

const content = await crawl({ domain, maxPages: 20, maxWords: 5_000, });
console.info(content);
