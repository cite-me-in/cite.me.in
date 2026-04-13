#! /usr/bin/env tsx

import analyzeSentiment from "../app/lib/llm-visibility/analyzeSentiment.ts";
import prisma from "../app/lib/prisma.server.ts";

async function main() {
  const domain = process.argv[2];

  const site = await prisma.site.findFirst({ where: { domain } });
  if (!site) throw new Error(`Site not found: ${domain}`);

  const runs = await prisma.citationQueryRun.findMany({
    distinct: ["platform"],
    orderBy: { onDate: "desc" },
    select: {
      id: true,
      onDate: true,
      platform: true,
      queries: { select: { query: true, text: true, citations: true } },
    },
    where: { siteId: site.id },
  });
  console.info(`Found ${runs.length} runs to update for ${domain}`);

  for (const run of runs) {
    console.info(`Updating ${run.platform} on ${run.onDate}...`);
    const result = await analyzeSentiment({ domain, queries: run.queries });

    await prisma.citationQueryRun.update({
      where: { id: run.id },
      data: {
        sentimentLabel: result.label,
        sentimentSummary: result.summary,
      },
    });
    console.info(`  ${result.label} (${result.summary})`);
  }
}

await main();
