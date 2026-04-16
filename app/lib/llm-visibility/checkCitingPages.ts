import { parallel } from "radashi";
import { sendCitedPageAlertEmail } from "~/emails/CitedPageAlert";
import { checkCitedPageHealth } from "~/lib/citedPageHealth.server";
import prisma from "~/lib/prisma.server";
import { hoursAgo } from "../formatDate";

export default async function ({
  staleHours = 24,
  limit = 100,
}: {
  staleHours?: number;
  limit?: number;
}): Promise<{ url: string; statusCode: number | null; isHealthy: boolean }[]> {
  const staleThreshold = hoursAgo(staleHours);
  const pages = await prisma.citedPage.findMany({
    where: {
      OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: staleThreshold } }],
    },
    include: { site: { select: { domain: true, owner: true } } },
    take: limit,
    orderBy: { citationCount: "desc" },
  });

  return await parallel({ limit: 10 }, pages, async (page) => {
    const { statusCode, contentHash, isHealthy } = await checkCitedPageHealth(
      page.url,
    );
    const wasHealthy = page.isHealthy;

    await prisma.citedPage.update({
      where: { id: page.id },
      data: { statusCode, contentHash, isHealthy, lastCheckedAt: new Date() },
    });

    if (wasHealthy && !isHealthy)
      await sendCitedPageAlertEmail({ page, site: page.site });

    return { url: page.url, statusCode, isHealthy };
  });
}
