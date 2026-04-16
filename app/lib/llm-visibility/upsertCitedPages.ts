import type { Prisma } from "~/prisma";
import prisma from "../prisma.server";

/**
 /**
  * Upsert CitedPage records for a given site and run.
  *
  * Cited pages are web pages (by URL) on a site that have been referenced (cited)
  * during an LLM (Large Language Model) run. Each cited page tracks how many times
  * it was referenced in that run. This provides visibility into which pages on your
  * domain have been used or quoted most, helping you understand what parts of your
  * content are being surfaced, summarized, or quoted by LLM-based features.
  *
  * @param run - The run to upsert cited pages for.
  * @param log - The log function to use.
  */
export default async function upsertCitedPages({
  log,
  run,
}: {
  log: (line: string) => Promise<unknown> | unknown;
  run: Prisma.CitationQueryRunGetPayload<{
    select: {
      id: true;
      site: true;
    };
  }>;
}) {
  const { domain, id: siteId } = run.site;
  await log(`Upserting cited pages for ${domain}`);
  const ownCitations = await prisma.citation.findMany({
    where: { runId: run.id, siteId },
    select: { url: true },
  });

  const urlCounts = new Map<string, number>();
  for (const { url } of ownCitations)
    urlCounts.set(url, (urlCounts.get(url) ?? 0) + 1);

  for (const [url, count] of urlCounts) {
    await prisma.citedPage.upsert({
      where: { siteId_url: { siteId, url } },
      create: { url, siteId, citationCount: count },
      update: { citationCount: { increment: count } },
    });
  }
}
