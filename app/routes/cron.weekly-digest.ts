import debug from "debug";
import captureException from "~/lib/captureException.server";
import envVars from "~/lib/envVars";
import prisma from "~/lib/prisma.server";
import {
  generateCitationChart,
  generateUnsubscribeToken,
  getWeeklyMetrics,
} from "~/lib/weeklyDigest.server";
import sendWeeklyDigestEmail from "~/emails/WeeklyDigest";
import type { Route } from "./+types/cron.weekly-digest";

const logger = debug("server");

export async function loader({ request }: Route.LoaderArgs) {
  if (request.headers.get("authorization") !== `Bearer ${envVars.CRON_SECRET}`)
    throw new Response("Unauthorized", { status: 401 });

  const sites = await prisma.site.findMany({
    select: {
      id: true,
      domain: true,
      owner: {
        select: { id: true, email: true, weeklyDigestEnabled: true },
      },
      siteUsers: {
        select: {
          user: { select: { id: true, email: true, weeklyDigestEnabled: true } },
        },
      },
    },
  });

  const results: { siteId: string; ok: boolean; sent: number; error?: string }[] =
    [];

  for (const site of sites) {
    try {
      const metrics = await getWeeklyMetrics(site.id, site.domain);
      const chartBase64 = await generateCitationChart(
        metrics.dailyCitations,
        metrics.prevDailyCitations,
      );

      const appUrl = envVars.VITE_APP_URL ?? "";
      const recipients = [
        site.owner,
        ...site.siteUsers.map((su) => su.user),
      ].filter((u) => u.weeklyDigestEnabled);

      let sent = 0;
      for (const user of recipients) {
        const token = generateUnsubscribeToken(user.id);
        const unsubscribeUrl = `${appUrl}/unsubscribe?token=${token}&user=${user.id}`;
        await sendWeeklyDigestEmail({
          to: user.email,
          domain: site.domain,
          unsubscribeUrl,
          metrics,
          chartBase64,
        });
        sent++;
      }

      logger("[cron:weekly-digest] Done — %s (%s), sent %d", site.id, site.domain, sent);
      results.push({ siteId: site.id, ok: true, sent });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger(
        "[cron:weekly-digest] Failed — %s (%s): %s",
        site.id,
        site.domain,
        message,
      );
      captureException(error, { extra: { siteId: site.id } });
      results.push({ siteId: site.id, ok: false, sent: 0, error: message });
    }
  }

  if (envVars.HEARTBEAT_CRON_WEEKLY_DIGEST)
    await fetch(envVars.HEARTBEAT_CRON_WEEKLY_DIGEST);

  return Response.json({ ok: true, results });
}
