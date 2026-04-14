#! /usr/bin/env tsx

import prisma from "../app/lib/prisma.server.ts";
import { normalizeDomain } from "../app/lib/isSameDomain.ts";

async function main() {
  const queries = await prisma.citationQuery.findMany({
    select: {
      id: true,
      citations: true,
      runId: true,
      run: { select: { siteId: true } },
    },
  });

  const classifications = await prisma.citationClassification.findMany({
    select: { url: true, runId: true, relationship: true, reason: true },
  });

  const classMap = new Map(
    classifications.map((c) => [`${c.runId}:${c.url}`, c]),
  );

  let created = 0;
  let skipped = 0;
  for (const q of queries) {
    for (const url of q.citations) {
      const cls = classMap.get(`${q.runId}:${url}`);
      try {
        await prisma.citation.upsert({
          where: { queryId_url: { queryId: q.id, url } },
          create: {
            url,
            domain: normalizeDomain(url),
            queryId: q.id,
            runId: q.runId,
            siteId: q.run.siteId,
            relationship: cls?.relationship ?? null,
            reason: cls?.reason ?? null,
          },
          update: {
            relationship: cls?.relationship ?? undefined,
            reason: cls?.reason ?? undefined,
          },
        });
        created++;
      } catch {
        skipped++;
      }
    }
  }

  console.info(`Backfilled ${created} Citation records (${skipped} skipped)`);
  await prisma.$disconnect();
}

await main();
