import { data } from "react-router";
import { sendCitedPageAlertEmail } from "~/emails/CitedPageAlert";
import captureAndLogError from "~/lib/captureAndLogError.server";
import { checkCitedPageHealth } from "~/lib/citedPageHealth.server";
import envVars from "~/lib/envVars.server";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/cron.check-cited-pages";

export const config = { maxDuration: 300 };

const STALE_HOURS = 24;

export async function loader({ request }: Route.LoaderArgs) {
  if (request.headers.get("authorization") !== `Bearer ${envVars.CRON_SECRET}`)
    throw new Response("Unauthorized", { status: 401 });

  try {
    const staleThreshold = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000);
    const pages = await prisma.citedPage.findMany({
      where: {
        OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: staleThreshold } }],
      },
      include: { site: { select: { ownerId: true } } },
      take: 100,
      orderBy: { citationCount: "desc" },
    });

    const results = [];
    for (const page of pages) {
      const { statusCode, contentHash, isHealthy } = await checkCitedPageHealth(page.url);
      const wasHealthy = page.isHealthy;

      await prisma.citedPage.update({
        where: { id: page.id },
        data: { statusCode, contentHash, isHealthy, lastCheckedAt: new Date() },
      });

      if (wasHealthy && !isHealthy)
        await sendCitedPageAlertEmail({ page, siteOwnerId: page.site.ownerId });

      results.push({ url: page.url, statusCode, isHealthy });
    }

    return data({ ok: true, checked: results.length, results });
  } catch (error) {
    captureAndLogError(error);
    return data({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}
