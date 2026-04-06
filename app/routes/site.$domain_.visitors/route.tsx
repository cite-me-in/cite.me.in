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
import NoVisitors from "./NoVisitors";
import VisitorKeyMetrics from "./VisitorKeyMetrics";
import VisitorTrafficChart from "./VisitorTrafficChart";

export const handle = { siteNav: true };

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    { title: `Human Visitors — ${loaderData?.site.domain} | Cite.me.in` },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { site } = await requireSiteAccess({ domain: params.domain, request });
  const { from, until } = parseDateRange(new URL(request.url).searchParams);
  const data = await getVisitorData(site.id, from, until);
  return { site, ...data };
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

  const chartData = Object.keys(dailyBySource)
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
    pct:
      totalVisitors > 0
        ? Math.round((platformTotals[p] / totalVisitors) * 100)
        : 0,
  }));

  const aiPct =
    totalVisitors > 0
      ? Math.round((aiReferredVisitors / totalVisitors) * 100)
      : 0;

  return {
    chartData,
    platforms,
    platformBreakdown,
    totalVisitors,
    totalPageViews,
    aiReferredVisitors,
    aiPct,
  };
}

export default function SiteVisitorsPage({ loaderData }: Route.ComponentProps) {
  const {
    site,
    chartData,
    platforms,
    platformBreakdown,
    totalVisitors,
    totalPageViews,
    aiReferredVisitors,
    aiPct,
  } = loaderData;

  const isEmpty = totalVisitors === 0;

  return (
    <Main variant="wide">
      <SitePageHeader site={site} title="Human Visitors">
        <DateRangeSelector />
      </SitePageHeader>

      {isEmpty ? (
        <NoVisitors domain={site.domain} />
      ) : (
        <section className="space-y-6">
          <VisitorKeyMetrics
            totalVisitors={totalVisitors}
            totalPageViews={totalPageViews}
            aiReferredVisitors={aiReferredVisitors}
            aiPct={aiPct}
          />
          <VisitorTrafficChart platforms={platforms} chartData={chartData} />
          <AiPlatformBreakdown platformBreakdown={platformBreakdown} />
        </section>
      )}
    </Main>
  );
}
