import { parallel } from "radashi";
import checkCitingPageHealth from "~/lib/citingPageHealth.server";
import { hoursAgo } from "~/lib/formatDate";
import prisma from "~/lib/prisma.server";

export default async function ({
  staleHours = 24,
  limit = 100,
}: {
  staleHours?: number;
  limit?: number;
}): Promise<{ url: string; statusCode: number | null; isHealthy: boolean }[]> {
  const staleThreshold = hoursAgo(staleHours);
  const pages = await prisma.citingPage.findMany({
    where: {
      OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: staleThreshold } }],
    },
    include: { site: { select: { domain: true, owner: true } } },
    take: limit,
    orderBy: { citationCount: "desc" },
  });

  return await parallel({ limit: 10 }, pages, async (page) => {
    const { statusCode, contentHash, isHealthy } = await checkCitingPageHealth(
      page.url,
    );

    await prisma.citingPage.update({
      where: { id: page.id },
      data: { statusCode, contentHash, isHealthy, lastCheckedAt: new Date() },
    });

    return { url: page.url, statusCode, isHealthy };
  });
}
