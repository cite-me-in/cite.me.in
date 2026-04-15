import prisma from "../prisma.server";

/**
 * Upsert CitedPage records for a given site and run.
 *
 * @param siteId - The ID of the site.
 * @param runId - The ID of the run.
 * @param domain - The domain of the site.
 * @param log - The log function to use.
 */
export default async function upsertCitedPages({
  log,
  siteId,
  runId,
  domain,
}: {
  log: (line: string) => Promise<unknown>;
  siteId: string;
  runId: string;
  domain: string;
}) {
  await log(`Upserting cited pages for ${domain}`);
  const ownCitations = await prisma.citation.findMany({
    where: { runId, siteId, domain },
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
