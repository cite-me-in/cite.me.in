import type { Temporal } from "@js-temporal/polyfill";
import { sum } from "radashi";
import DateRangeSelector, {
  parseDateRange,
} from "~/components/ui/DateRangeSelector";
import Main from "~/components/ui/Main";
import SitePageHeader from "~/components/ui/SiteHeading";
import { requireSiteAccess } from "~/lib/auth.server";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/route";
import AiPlatformBreakdown from "./AiPlatformBreakdown";
import BotActivity from "./BotActivity";
import BotInsights from "./BotInsights";
import BotTrafficTrend from "./BotTrafficTrend";
import NoVisitors from "./NoVisitors";
import VisitorKeyMetrics from "./VisitorKeyMetrics";
import VisitorTrafficChart from "./VisitorTrafficChart";

export const handle = { siteNav: true };

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `Traffic — ${loaderData?.site.domain} | Cite.me.in` }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { site } = await requireSiteAccess({ domain: params.domain, request });
  const { from, until } = parseDateRange(new URL(request.url).searchParams);
  const [visitorData, botData, insight] = await Promise.all([
    getVisitorData(site.id, from, until),
    getBotTotals(site.id, from, until),
    getBotInsight(site.id),
  ]);
  return { site, ...visitorData, ...botData, insight };
}

async function getVisitorData(
  siteId: string,
  from: Temporal.PlainDate,
  until: Temporal.PlainDate,
) {
  const visits = await prisma.humanVisit.findMany({
    where: {
      siteId,
      date: {
        gte: new Date(from.toZonedDateTime("UTC").epochMilliseconds),
        lte: new Date(until.toZonedDateTime("UTC").epochMilliseconds),
      },
    },
    select: { date: true, count: true, aiReferral: true },
    orderBy: { date: "asc" },
  });

  const dailyBySource: Record<string, Record<string, number>> = {};
  let totalVisitors = 0;
  let totalPageViews = 0;
  let aiReferredVisitors = 0;
  const platformTotals: Record<string, number> = {};

  for (const v of visits) {
    const day = v.date.toISOString().slice(0, 10);
    const source = v.aiReferral ?? "nonAi";
    if (!dailyBySource[day]) dailyBySource[day] = {};
    dailyBySource[day][source] = (dailyBySource[day][source] ?? 0) + 1;
    totalVisitors += 1;
    totalPageViews += v.count;
    if (v.aiReferral) {
      aiReferredVisitors += 1;
      platformTotals[v.aiReferral] = (platformTotals[v.aiReferral] ?? 0) + 1;
    }
  }

  const platforms = Object.entries(platformTotals)
    .sort(([, a], [, b]) => b - a)
    .map(([p]) => p);

  const visitorChartData = Object.keys(dailyBySource)
    .sort()
    .map((date) => ({
      date,
      total: sum(Object.values(dailyBySource[date]), (c) => c),
      nonAi: dailyBySource[date].nonAi ?? 0,
      ...Object.fromEntries(
        platforms.map((p) => [p, dailyBySource[date][p] ?? 0]),
      ),
    }));

  const platformBreakdown = platforms.map((p) => ({
    platform: p,
    visitors: platformTotals[p],
    pct: totalVisitors > 0 ? (platformTotals[p] / totalVisitors) * 100 : 0,
  }));

  const aiPct =
    totalVisitors > 0 ? (aiReferredVisitors / totalVisitors) * 100 : 0;

  return {
    visitorChartData,
    platforms,
    platformBreakdown,
    totalVisitors,
    totalPageViews,
    aiReferredVisitors,
    aiPct,
  };
}

async function getBotTotals(
  siteId: string,
  from: Temporal.PlainDate,
  until: Temporal.PlainDate,
) {
  const visits = await prisma.botVisit.findMany({
    where: {
      siteId,
      date: {
        gte: new Date(from.toZonedDateTime("UTC").epochMilliseconds),
        lte: new Date(until.toZonedDateTime("UTC").epochMilliseconds),
      },
    },
    orderBy: { date: "asc" },
  });

  const dailyByBot: Record<string, Record<string, number>> = {};
  for (const v of visits) {
    const day = v.date.toISOString().slice(0, 10);
    if (!dailyByBot[day]) dailyByBot[day] = {};
    dailyByBot[day][v.botType] = (dailyByBot[day][v.botType] ?? 0) + v.count;
  }

  const botTotals: Record<string, number> = {};
  for (const v of visits)
    botTotals[v.botType] = (botTotals[v.botType] ?? 0) + v.count;

  const topBots = Object.entries(botTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([botType]) => botType);

  const botChartData = Object.keys(dailyByBot)
    .sort()
    .map((date) => ({
      date,
      total: sum(Object.values(dailyByBot[date]), (c) => c),
      ...Object.fromEntries(
        topBots.map((bot) => [bot, dailyByBot[date][bot] ?? 0]),
      ),
    }));

  const byBot: Record<
    string,
    {
      botClass: string;
      botType: string;
      total: number;
      paths: Set<string>;
      accepts: Set<string>;
      referer: string | null;
    }
  > = {};
  for (const v of visits) {
    if (!byBot[v.botType])
      byBot[v.botType] = {
        botClass: v.botClass,
        botType: v.botType,
        total: 0,
        paths: new Set(),
        accepts: new Set(),
        referer: v.referer,
      };
    byBot[v.botType].total += v.count;
    byBot[v.botType].paths.add(v.path);
    for (const mime of v.accept) byBot[v.botType].accepts.add(mime);
  }

  const botActivity = Object.values(byBot)
    .map((b) => ({
      botClass: b.botClass,
      botType: b.botType,
      total: b.total,
      uniquePaths: b.paths.size,
      accepts: [...b.accepts].sort(),
      referer: b.referer,
    }))
    .sort((a, b) => {
      const classOrder = {
        retrieval: 0,
        search_indexing: 1,
        training: 2,
        other: 3,
      };
      const aOrder = classOrder[a.botClass as keyof typeof classOrder] ?? 4;
      const bOrder = classOrder[b.botClass as keyof typeof classOrder] ?? 4;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return b.total - a.total;
    });

  const totalBotVisits = sum(Object.values(botTotals), (c) => c);

  return {
    botChartData,
    topBots,
    botActivity,
    totalBotVisits,
    uniqueBots: Object.keys(botTotals).length,
  };
}

async function getBotInsight(siteId: string) {
  return await prisma.botInsight.findUnique({
    where: { siteId },
  });
}

export default function TrafficPage({ loaderData }: Route.ComponentProps) {
  const {
    site,
    visitorChartData,
    platforms,
    platformBreakdown,
    totalVisitors,
    totalPageViews,
    aiReferredVisitors,
    aiPct,
    botChartData,
    topBots,
    botActivity,
    totalBotVisits,
    insight,
  } = loaderData;

  const hasVisitors = totalVisitors > 0;
  const hasBots = totalBotVisits > 0;

  return (
    <Main variant="wide">
      <SitePageHeader site={site} title="Traffic">
        <DateRangeSelector />
      </SitePageHeader>

      <section className="space-y-6">
        {hasVisitors ? (
          <>
            <VisitorKeyMetrics
              totalVisitors={totalVisitors}
              totalPageViews={totalPageViews}
              aiReferredVisitors={aiReferredVisitors}
              aiPct={aiPct}
            />
            <VisitorTrafficChart
              platforms={platforms}
              chartData={visitorChartData}
            />
            <AiPlatformBreakdown platformBreakdown={platformBreakdown} />
          </>
        ) : (
          <NoVisitors domain={site.domain} />
        )}

        {insight && <BotInsights insight={insight} />}

        {hasBots && (
          <>
            <BotTrafficTrend topBots={topBots} chartData={botChartData} />
            <BotActivity botActivity={botActivity} />
          </>
        )}
      </section>
    </Main>
  );
}
