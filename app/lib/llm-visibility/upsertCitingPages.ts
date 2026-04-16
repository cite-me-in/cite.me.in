import type { Prisma } from "~/prisma";
import prisma from "../prisma.server";

/**
 /**
  * Citing pages are web pages (by URL) that may have been citing the domain
  * during an LLM (Large Language Model) run. This provides visibility into which
  * pages on your domain have been used or quoted most, helping you understand what
  * parts of your content are being surfaced, summarized, or quoted by LLM-based
  * features.
  *
  * @param run - The run to upsert citing pages for.
  * @param log - The log function to use.
  */
export default async function upsertCitingPages({
  log,
  run,
}: {
  log: (line: string) => Promise<unknown> | unknown;
  run: Prisma.CitationQueryRunGetPayload<{
    select: {
      id: true;
      site: { select: { id: true; domain: true } };
    };
  }>;
}) {
  const { domain, id: siteId } = run.site;
  await log(`Upserting citing pages for ${domain}`);
  const ownCitations = await prisma.citation.findMany({
    where: { runId: run.id, siteId },
    select: { url: true },
  });

  const urlCounts = new Map<string, number>();
  for (const { url } of ownCitations)
    urlCounts.set(url, (urlCounts.get(url) ?? 0) + 1);

  for (const [url, count] of urlCounts) {
    await prisma.citingPage.upsert({
      where: { siteId_url: { siteId, url } },
      create: { url, siteId, citationCount: count },
      update: { citationCount: { increment: count } },
    });
  }
}
