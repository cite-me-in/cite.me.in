import { parallel } from "radashi";
import { sendCitingPageAlertEmail } from "~/emails/CitingPageAlert";
import { checkCitingPageHealth } from "~/lib/citingPageHealth.server";
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
    const wasHealthy = page.isHealthy;

    await prisma.citingPage.update({
      where: { id: page.id },
      data: { statusCode, contentHash, isHealthy, lastCheckedAt: new Date() },
    });

    if (wasHealthy && !isHealthy)
      await sendCitingPageAlertEmail({ page, site: page.site });

    return { url: page.url, statusCode, isHealthy };
  });
}
