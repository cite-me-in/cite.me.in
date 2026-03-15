import { Temporal } from "@js-temporal/polyfill";
import debug from "debug";
import envVars from "~/lib/envVars";
import generateBotInsight from "~/lib/llm-visibility/generateBotInsight";
import logError from "~/lib/logError.server";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/cron.bot-insights";

const logger = debug("server");

// Vercel Cron fires a GET with Authorization: Bearer <CRON_SECRET>.
export async function loader({ request }: Route.LoaderArgs) {
  if (request.headers.get("authorization") !== `Bearer ${envVars.CRON_SECRET}`)
    throw new Response("Unauthorized", { status: 401 });

  const since = new Date(
    Temporal.Now.instant().subtract({ hours: 24 }).epochMilliseconds,
  );

  const sites = await prisma.site.findMany({
    where: { botVisits: { some: { date: { gte: since } } } },
    select: { id: true, domain: true },
  });

  logger(
    "[cron:bot-insights] Sites with recent visits: %s",
    sites.map((s) => s.domain).join(", "),
  );

  const results: { siteId: string; ok: boolean; error?: string }[] = [];

  for (const site of sites) {
    try {
      const sevenDaysAgo = new Date(
        Temporal.Now.instant().subtract({ hours: 24 * 7 }).epochMilliseconds,
      );

      const visits = await prisma.botVisit.findMany({
        where: { siteId: site.id, date: { gte: sevenDaysAgo } },
        select: { botType: true, path: true, count: true },
      });

      const byBot: Record<
        string,
        { total: number; pathCounts: Record<string, number> }
      > = {};
      for (const v of visits) {
        if (!byBot[v.botType]) byBot[v.botType] = { total: 0, pathCounts: {} };
        byBot[v.botType].total += v.count;
        byBot[v.botType].pathCounts[v.path] =
          (byBot[v.botType].pathCounts[v.path] ?? 0) + v.count;
      }

      const botStats = Object.entries(byBot)
        .sort(([, a], [, b]) => b.total - a.total)
        .map(([botType, { total, pathCounts }]) => ({
          botType,
          total,
          topPaths: Object.entries(pathCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([p]) => p),
        }));

      const content = await generateBotInsight(site.domain, botStats);
      const now = new Date();

      await prisma.botInsight.upsert({
        where: { siteId: site.id },
        create: { siteId: site.id, content, generatedAt: now },
        update: { content, generatedAt: now },
      });

      logger("[cron:bot-insights] Done — %s (%s)", site.id, site.domain);
      results.push({ siteId: site.id, ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger(
        "[cron:bot-insights] Failed — %s (%s): %s",
        site.id,
        site.domain,
        message,
      );
      logError(error, { extra: { siteId: site.id } });
      results.push({ siteId: site.id, ok: false, error: message });
    }
  }

  if (envVars.HEARTBEAT_CRON_BOT_INSIGHTS)
    await fetch(envVars.HEARTBEAT_CRON_BOT_INSIGHTS);
  return Response.json({ ok: true, results });
}
