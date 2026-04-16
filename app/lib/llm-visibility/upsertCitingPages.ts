import { group, listify } from "radashi";
import PLATFORMS from "~/lib/llm-visibility/platformQueries.server";
import prisma from "../prisma.server";

/**
 * Citing pages are web pages (by URL) that may have been citing the domain
 * during an LLM (Large Language Model) run. This provides visibility into which
 * pages on your domain have been used or quoted most, helping you understand what
 * parts of your content are being surfaced, summarized, or quoted by LLM-based
 * features.
 *
 * @param site - The site to upsert citing pages for.
 * @param log - The log function to use.
 */
export default async function upsertCitingPages({
  log,
  site,
}: {
  log: (line: string) => Promise<unknown> | unknown;
  site: { id: string; domain: string };
}) {
  const { domain, id: siteId } = site;
  await log(`Updating citing pages for ${domain}`);

  // Find the most recent run for each platform and load them all so we can
  // count citations from all platforms.
  const runs = await prisma.citationQueryRun.findMany({
    where: { siteId },
    select: { citations: { select: { url: true } } },
    distinct: ["platform"],
    orderBy: { onDate: "desc" },
    take: PLATFORMS.length,
  });

  // Flatten the citations, group them by URL and count the number of citations
  // for each URL, resulting in a list of [url, count] pairs.
  const citations = runs.flatMap((r) => r.citations);
  const grouped = group(citations, (c) => c.url) as {
    [url: string]: { url: string }[];
  };
  const counts = listify<{ url: string }[], string, [string, number]>(
    grouped,
    (url, citations) => [url, citations.length],
  );

  // Insert new URLs and delete URLs that are no longer cited.
  await prisma.citingPage.createMany({
    data: counts.map(([url, count]) => ({
      url,
      siteId,
      citationCount: count,
    })),
    skipDuplicates: true,
  });
  await prisma.citingPage.deleteMany({
    where: { siteId, url: { notIn: counts.map(([url]) => url) } },
  });
}
