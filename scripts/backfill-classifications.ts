#! /usr/bin/env tsx

import analyzeSentiment from "../app/lib/llm-visibility/analyzeSentiment.ts";
import prisma from "../app/lib/prisma.server.ts";

async function main() {
  const domain = process.argv[2];
  const where = domain ? { site: { domain } } : {};
  const runs = await prisma.citationQueryRun.findMany({
    orderBy: { onDate: "desc" },
    select: {
      id: true,
      onDate: true,
      platform: true,
      site: { select: { id: true, domain: true, summary: true } },
      queries: { select: { query: true, text: true, citations: true } },
      _count: { select: { classifications: true } },
    },
    where,
    distinct: ["platform"],
  });

  const needsBackfill = runs.filter(
    (runs) => runs._count.classifications === 0,
  );
  console.info(
    `Found ${needsBackfill.length} runs needing backfill (of ${runs.length} total)`,
  );

  for (const run of needsBackfill) {
    console.info(
      `Backfilling ${run.site.domain} / ${run.platform} on ${run.onDate}...`,
    );

    const result = await analyzeSentiment({
      domain: run.site.domain,
      queries: run.queries,
      siteSummary: run.site.summary ?? undefined,
    });

    if (result.citations.length > 0) {
      await prisma.citationClassification.createMany({
        data: result.citations.map((classification) => ({
          url: classification.url,
          siteId: run.site.id,
          runId: run.id,
          relationship: classification.relationship,
          reason: classification.reason,
        })),
        skipDuplicates: true,
      });
    }

    const direct = result.citations.filter(
      (classification) => classification.relationship === "direct",
    ).length;
    const indirect = result.citations.filter(
      (classification) => classification.relationship === "indirect",
    ).length;
    console.info(`  ${direct} direct, ${indirect} indirect citations`);
  }

  console.info("Done!");
}

await main();
