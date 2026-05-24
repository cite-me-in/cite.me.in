import { parallel } from "radashi";
import checkCitingPageHealth from "~/lib/citingPageHealth.server";
import { daysAgo } from "~/lib/formatDate";
import prisma from "~/lib/prisma.server";

/**
 * Check the health of citing pages that have not been checked in a while.
 *
 * @param staleDays - The number of days to consider a page stale.
 * @param limit - The maximum number of pages to check.
 * @returns The citing pages that were just checked.
 */
export default async function checkCitingPages({
  staleDays,
  limit,
}: {
  staleDays: number;
  limit: number;
}): Promise<{ url: string; statusCode: number | null; isHealthy: boolean }[]> {
  const staleThreshold = daysAgo(staleDays);
  const pages = await prisma.citingPage.findMany({
    include: { site: { select: { domain: true, owner: true } } },
    orderBy: { citationCount: "desc" },
    take: limit,
    where: {
      OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: staleThreshold } }],
    },
  });

  return await parallel({ limit: 10 }, pages, async (page) => {
    const { statusCode, contentHash, isHealthy } = await checkCitingPageHealth(page.url);

    await prisma.citingPage.update({
      where: { id: page.id },
      data: { statusCode, contentHash, isHealthy, lastCheckedAt: new Date() },
    });

    return { url: page.url, statusCode, isHealthy };
  });
}
