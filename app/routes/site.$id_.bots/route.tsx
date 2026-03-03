export const handle = { siteNav: true };

import { sumBy } from "es-toolkit";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/Card";
import { ChartContainer } from "~/components/ui/Chart";
import DateRangeSelector, {
  parseDateRange,
} from "~/components/ui/DateRangeSelector";
import SitePageHeader from "~/components/ui/SitePageHeader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/Table";
import { requireUser } from "~/lib/auth.server";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/route";

export function meta({ data }: Route.MetaArgs) {
  return [{ title: `Bot Traffic — ${data?.site.domain} | CiteUp` }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const site = await prisma.site.findFirst({
    where: { id: params.id, accountId: user.accountId },
  });
  if (!site) throw new Response("Not found", { status: 404 });

  const { from, until, period } = parseDateRange(
    new URL(request.url).searchParams,
  );

  const visits = await prisma.botVisit.findMany({
    where: {
      siteId: site.id,
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
    site,
    chartData,
    topBots,
    botActivity,
    topPaths,
    mimeTypes,
    totalVisits,
    uniqueBots: Object.keys(botTotals).length,
    period,
  };
}

const BOT_COLORS = [
  "#111111",
  "#e63946",
  "#457b9d",
  "#2a9d8f",
  "#e9c46a",
  "#f4a261",
  "#264653",
  "#a8dadc",
  "#6a4c93",
  "#c77dff",
] as const;

const fmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

export default function SiteBotsPage({ loaderData }: Route.ComponentProps) {
  const {
    site,
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
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-12">
      <SitePageHeader site={site} title="Bot Traffic">
        <DateRangeSelector />
      </SitePageHeader>

      {isEmpty ? (
        <div className="rounded-base border-2 border-black bg-secondary-background p-12 text-center shadow-shadow">
          <p className="mb-2 font-bold text-xl">No bot traffic recorded</p>
          <p className="text-base text-foreground/60">
            Bot visits are tracked automatically. Check back once bots have
            crawled {site.domain}.
          </p>
        </div>
      ) : (
        <section className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Total Visits", value: totalVisits.toLocaleString() },
              { label: "Unique Bots", value: uniqueBots },
              {
                label: "Avg Daily Visits",
                value: Math.round(totalVisits / period).toLocaleString(),
              },
            ].map(({ label, value }) => (
              <Card key={label}>
                <CardContent className="pt-6">
                  <p className="text-base text-foreground/60">{label}</p>
                  <p className="font-bold text-2xl">{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Traffic Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={Object.fromEntries(
                  topBots.map((bot, i) => [
                    bot,
                    { label: bot, color: BOT_COLORS[i % BOT_COLORS.length] },
                  ]),
                )}
                className="h-48 w-full"
              >
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v) => fmt.format(new Date(v))}
                  />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(v) =>
                      new Intl.DateTimeFormat("en-US", {
                        dateStyle: "long",
                      }).format(new Date(v as string))
                    }
                  />
                  <Legend />
                  <Line
                    dataKey="total"
                    name="Total"
                    stroke="#111111"
                    strokeWidth={2}
                    type="monotone"
                  />
                  {topBots.slice(0, 5).map((bot, i) => (
                    <Line
                      dataKey={bot}
                      key={bot}
                      name={bot}
                      stroke={BOT_COLORS[(i + 1) % BOT_COLORS.length]}
                      strokeDasharray="4 2"
                      strokeWidth={1.5}
                      type="monotone"
                    />
                  ))}
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bot Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bot</TableHead>
                    <TableHead className="text-right">Visits</TableHead>
                    <TableHead className="text-right">Paths</TableHead>
                    <TableHead>Accept Types</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {botActivity.map((row) => (
                    <TableRow key={row.botType}>
                      <TableCell className="font-medium">
                        {row.botType}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.total.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.uniquePaths}
                      </TableCell>
                      <TableCell className="text-foreground/60 text-xs">
                        {row.accepts.length > 0 ? row.accepts.join(", ") : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Top Paths</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Path</TableHead>
                      <TableHead className="text-right">Visits</TableHead>
                      <TableHead className="text-right">Bots</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topPaths.map((row) => (
                      <TableRow key={row.path}>
                        <TableCell className="font-mono text-base">
                          {row.path}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.count.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.uniqueBots}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Accept Types</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>MIME Type</TableHead>
                      <TableHead className="text-right">Visits</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mimeTypes.map((row) => (
                      <TableRow key={row.mime}>
                        <TableCell className="font-mono text-base">
                          {row.mime}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.count.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </section>
      )}
    </main>
  );
}
