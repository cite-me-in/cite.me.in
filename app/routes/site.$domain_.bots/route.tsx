import type { Temporal } from "@js-temporal/polyfill";
import { sumBy } from "es-toolkit";
import DateRangeSelector, {
  parseDateRange,
} from "~/components/ui/DateRangeSelector";
import Main from "~/components/ui/Main";
import SitePageHeader from "~/components/ui/SitePageHeader";
import { requireUser } from "~/lib/auth.server";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/route";
import BotAcceptTypes from "./BotAcceptTypes";
import BotActivity from "./BotActivity";
import BotInsights from "./BotInsights";
import BotKeyMetrics from "./BotKeyMetrics";
import BotTopPaths from "./BotTopPaths";
import BotTrafficTrend from "./BotTrafficTrend";
import NoTraffic from "./NoTraffic";

export const handle = { siteNav: true };

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `Bot Traffic — ${loaderData?.site.domain} | Cite.me.in` }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const site = await prisma.site.findFirst({
    where: {
      id: params.id,
      OR: [
        { ownerId: user.id },
        { siteUsers: { some: { userId: user.id } } },
      ],
    },
  });
  if (!site) throw new Response("Not found", { status: 404 });

  const { from, until, period } = parseDateRange(
    new URL(request.url).searchParams,
  );
  const [insight, data] = await Promise.all([
    getBotInsight(site.id),
    getBotTotals(site.id, from, until),
  ]);

  return {
    ...data,
    site,
    insight,
    period,
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

  // Chart: daily totals keyed by bot type
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

  const chartData = Object.keys(dailyByBot)
    .sort()
    .map((date) => ({
      date,
      total: sumBy(Object.values(dailyByBot[date]), (c) => c),
      ...Object.fromEntries(
        topBots.map((bot) => [bot, dailyByBot[date][bot] ?? 0]),
      ),
    }));

  // Bot activity table
  const byBot: Record<
    string,
    {
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
      botType: b.botType,
      total: b.total,
      uniquePaths: b.paths.size,
      accepts: [...b.accepts].sort(),
      referer: b.referer,
    }))
    .sort((a, b) => b.total - a.total);

  // Top paths table
  const byPath: Record<
    string,
    { path: string; count: number; bots: Set<string> }
  > = {};
  for (const v of visits) {
    if (!byPath[v.path])
      byPath[v.path] = { path: v.path, count: 0, bots: new Set() };
    byPath[v.path].count += v.count;
    byPath[v.path].bots.add(v.botType);
  }

  const topPaths = Object.values(byPath)
    .map((s) => ({ path: s.path, count: s.count, uniqueBots: s.bots.size }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  // MIME type breakdown
  const mimeCounts: Record<string, number> = {};
  for (const v of visits)
    for (const mime of v.accept)
      mimeCounts[mime] = (mimeCounts[mime] ?? 0) + v.count;

  const mimeTypes = Object.entries(mimeCounts)
    .map(([mime, count]) => ({ mime, count }))
    .sort((a, b) => b.count - a.count);

  const totalVisits = sumBy(Object.values(botTotals), (c) => c);

  return {
    chartData,
    topBots,
    botActivity,
    topPaths,
    mimeTypes,
    totalVisits,
    uniqueBots: Object.keys(botTotals).length,
  };
}

async function getBotInsight(siteId: string) {
  return await prisma.botInsight.findUnique({
    where: { siteId },
  });
}

export default function SiteBotsPage({ loaderData }: Route.ComponentProps) {
  const {
    site,
    insight,
    chartData,
    topBots,
    botActivity,
    topPaths,
    mimeTypes,
    totalVisits,
    uniqueBots,
    period,
  } = loaderData;

  const isEmpty = totalVisits === 0;

  return (
    <Main variant="wide">
      <SitePageHeader site={site} title="Bot Traffic">
        <DateRangeSelector />
      </SitePageHeader>

      {isEmpty ? (
        <NoTraffic domain={site.domain} />
      ) : (
        <section className="space-y-6">
          <BotKeyMetrics
            totalVisits={totalVisits}
            uniqueBots={uniqueBots}
            period={period}
          />
          {insight && <BotInsights insight={insight} />}
          <BotTrafficTrend topBots={topBots} chartData={chartData} />
          <BotActivity botActivity={botActivity} />

          <div className="grid grid-cols-2 gap-6">
            <BotTopPaths topPaths={topPaths} />
            <BotAcceptTypes mimeTypes={mimeTypes} />
          </div>
        </section>
      )}
    </Main>
  );
}
