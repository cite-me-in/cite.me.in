import { alphabetical, unique } from "radashi";
import { useSearchParams } from "react-router";
import Main from "~/components/ui/Main";
import SitePageHeader from "~/components/ui/SiteHeading";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/Tabs";
import { requireSiteAccess } from "~/lib/auth.server";
import { getDomainMeta } from "~/lib/domainMeta.server";
import PLATFORMS from "~/lib/llm-visibility/platforms";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/route";
import BrandSentiment from "./BrandSentiment";
import CitationsRecentRun from "./CitationsRecentRun";
import TopCompetitors, { topCompetitors } from "./TopCompetitors";
import VisibilityCharts from "./VisibilityCharts";

export const handle = { siteNav: true };

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `Citations — ${loaderData?.site.domain} | Cite.me.in` }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { site } = await requireSiteAccess({ domain: params.domain, request });

  const [runs, siteQueries] = await Promise.all([
    prisma.citationQueryRun.findMany({
      include: { queries: true },
      orderBy: [{ platform: "asc" }, { onDate: "desc" }],
      where: { siteId: site.id },
    }),
    prisma.siteQuery.findMany({
      where: { siteId: site.id },
      orderBy: [{ group: "asc" }, { query: "asc" }],
    }),
  ]);

  const url = new URL(request.url);
  const platform =
    PLATFORMS.find((p) => p.name === url.searchParams.get("platform")) ??
    PLATFORMS[0];

  const recentRuns = runs.filter((r) => r.platform === platform.name);
  const queriesForCompetitors = siteQueries
    .map((sq) => {
      for (const r of recentRuns) {
        const found = r.queries.find((q) => q.query === sq.query);
        if (found) return found;
      }
      return null;
    })
    .filter((q) => q !== null);

  const {
    competitors: rawCompetitors,
    ownCitations,
    total,
  } = topCompetitors(queriesForCompetitors, site.domain);
  const competitors = await Promise.all(
    rawCompetitors.map(async (c) => ({
      ...c,
      ...(await getDomainMeta(c.domain)),
    })),
  );

  return {
    site,
    runs,
    siteQueries,
    competitors,
    shareOfVoice: {
      count: ownCitations,
      pct: total > 0 ? Math.round((ownCitations / total) * 100) : 0,
    },
  };
}

export default function SiteCitationsPage({
  loaderData,
}: Route.ComponentProps) {
  const { site, runs, siteQueries, competitors, shareOfVoice } = loaderData;
  const [searchParams, setSearchParams] = useSearchParams();
  const platform =
    PLATFORMS.find((p) => p.name === searchParams.get("platform")) ??
    PLATFORMS[0];
  const recentRuns = runs.filter((r) => r.platform === platform.name);
  const run = recentRuns[0];

  const mergedQueries = unique(
    siteQueries
      .map((sq) => {
        for (const r of recentRuns) {
          const found = r.queries.find((q) => q.query === sq.query);
          if (found) return { ...found, onDate: r.onDate };
        }
        return null;
      })
      .filter((q) => q !== null),
    (q) => q.id,
  );

  const sentiment = [...recentRuns]
    .filter((r) => r.sentimentLabel !== null)
    .sort(
      (a, b) => new Date(b.onDate).getTime() - new Date(a.onDate).getTime(),
    )[0];

  return (
    <Main variant="wide">
      <SitePageHeader
        site={site}
        title="Citation visibility"
        backTo={{ label: "Edit queries", path: `/site/${site.domain}/queries` }}
      />

      <div className="flex justify-center">
        <Tabs
          className="mx-auto"
          defaultValue={platform.name}
          onValueChange={(platform) => setSearchParams({ platform })}
        >
          <TabsList>
            {alphabetical(PLATFORMS, ({ label }) => label).map((platform) => (
              <TabsTrigger key={platform.name} value={platform.name}>
                {platform.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {run ? (
        <>
          <CitationsRecentRun queries={mergedQueries} meta={run} site={site} />
          <BrandSentiment
            sentiment={sentiment}
            platformLabel={platform.label}
          />
          <TopCompetitors
            competitors={competitors}
            shareOfVoice={shareOfVoice}
          />
          <VisibilityCharts recentRuns={recentRuns} site={site} />
        </>
      ) : (
        <p className="flex items-center justify-center py-8 text-center text-foreground/60 text-lg">
          <span aria-label="sad face" role="img" className="mr-2">
            😔
          </span>
          No runs yet for {platform.label}.
        </p>
      )}
    </Main>
  );
}
