#!/usr/bin/env tsx

/**
 * This is used to crawl a website and return the content.
 *
 * Usage:
 *   npx tsx scripts/crawl.ts <domain> [maxPages] [maxWords] [maxSeconds]
 */

import { execSync } from "node:child_process";
import { normalizeDomain } from "../app/lib/isSameDomain";
import prisma from "../app/lib/prisma.server";
import { crawl } from "../app/lib/scrape/crawl";
import { summarize } from "../app/lib/scrape/summarize";

const domain = normalizeDomain(process.argv[2]);
if (!domain) {
  console.error(
    "Usage: ./scripts/crawl.ts <domain> [maxPages] [maxWords] [maxSeconds]",
  );
  process.exit(1);
}

const email = execSync("git config user.email", { encoding: "utf-8" }).trim();
if (!email) {
  console.error("No git user email is set.");
  process.exit(1);
}

console.info(`Looking for site: ${domain} for email: ${email}`);
const site = await prisma.site.findFirst({
  where: { domain, owner: { email: email } },
});
if (!site) {
  console.error(`Site not found: ${domain} for email: ${email}`);
  process.exit(1);
}

const content = await crawl({ domain, maxPages: 20, maxWords: 5_000 });
console.info(content);
const summary = await summarize({ domain, content });
console.info(summary);

await prisma.site.update({
  where: { id: site.id },
  data: { content, summary },
});
