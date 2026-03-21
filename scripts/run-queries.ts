#!/usr/bin/env tsx

/**
 * Backfill citation runs for all existing queries of a site.
 *
 * Usage:
 *   ./scripts/run-queries.ts <domain>
 *   NODE_ENV=production infisical --env prod run -- ./scripts/run-queries.ts <domain>
 */

import { runQueryOnAllPlatforms } from "../app/lib/addSiteQueries";
import { updateRunSentiment } from "../app/lib/llm-visibility/queryPlatform";
import { isMeaningfulSentence } from "../app/lib/llm-visibility/queryValidation";
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

const meaningful = queries.filter((q) => isMeaningfulSentence(q.query));

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

// Run sentiment analysis for each platform's run after all queries complete.
const onDate = new Date().toISOString().split("T")[0];
const runs = await prisma.citationQueryRun.findMany({
  where: { siteId: site.id, onDate },
});
console.info("Analyzing sentiment for %d runs…", runs.length);
for (const run of runs) {
  await updateRunSentiment({ site, platform: run.platform, runId: run.id });
  console.info("  [%s] sentiment done", run.platform);
}

console.info("Done.");
