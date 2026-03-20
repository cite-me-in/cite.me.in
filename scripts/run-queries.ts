#!/usr/bin/env tsx

/**
 * Backfill citation runs for all existing queries of a site.
 *
 * Usage: ./scripts/run-queries.ts <domain>
 */

import { runQueryOnAllPlatforms } from "../app/lib/addSiteQueries";
import prisma from "../app/lib/prisma.server";

const domain = process.argv[2];
if (!domain) {
  console.error("Usage: ./scripts/run-queries.ts <domain>");
  process.exit(1);
}

const site = await prisma.site.findFirst({ where: { domain } });
if (!site) {
  console.error("Site not found: %s", domain);
  process.exit(1);
}

const queries = await prisma.siteQuery.findMany({
  where: { siteId: site.id },
  orderBy: [{ group: "asc" }, { createdAt: "asc" }],
});

const meaningful = queries.filter(
  (q) => q.query.trim().split(/\s+/).filter(Boolean).length >= 3,
);

console.info(
  "Running %d queries for %s (skipping %d non-sentences)…",
  meaningful.length,
  domain,
  queries.length - meaningful.length,
);

for (const q of meaningful) {
  console.info("  [%s] %s", q.group, q.query);
  await runQueryOnAllPlatforms({ site, query: q.query, group: q.group });
}

console.info("Done.");
