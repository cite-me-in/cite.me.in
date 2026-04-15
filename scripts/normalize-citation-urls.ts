#! /usr/bin/env tsx

import { normalizeUrl } from "../app/lib/isSameDomain";
import prisma from "../app/lib/prisma.server";

async function main() {
  const citations = await prisma.citation.findMany({
    select: { id: true, url: true, siteId: true, runId: true, queryId: true },
  });

  console.log(`Found ${citations.length} citations`);

  let updated = 0;
  let duplicates = 0;

  for (const citation of citations) {
    const normalized = normalizeUrl(citation.url);
    if (normalized !== citation.url) {
      const existing = await prisma.citation.findFirst({
        where: {
          url: normalized,
          siteId: citation.siteId,
          runId: citation.runId,
          queryId: citation.queryId,
          id: { not: citation.id },
        },
      });

      if (existing) {
        await prisma.citation.delete({ where: { id: citation.id } });
        duplicates++;
      } else {
        await prisma.citation.update({
          where: { id: citation.id },
          data: { url: normalized },
        });
        updated++;
      }
    }
  }

  console.log(`Updated ${updated} citations with normalized URLs`);
  console.log(`Removed ${duplicates} duplicate citations`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
