#! /usr/bin/env tsx

import { isSameDomain } from "../app/lib/isSameDomain";
import prisma from "../app/lib/prisma.server";

async function main() {
  const citations = await prisma.citation.findMany({
    where: { relationship: null },
    select: { id: true, url: true, site: { select: { domain: true } } },
  });

  console.log(`Found ${citations.length} citations without relationship`);

  let updated = 0;
  for (const citation of citations) {
    if (isSameDomain({ domain: citation.site.domain, url: citation.url })) {
      await prisma.citation.update({
        where: { id: citation.id },
        data: { relationship: "exact" },
      });
      updated++;
    }
  }

  console.log(`Updated ${updated} citations with relationship "exact"`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
