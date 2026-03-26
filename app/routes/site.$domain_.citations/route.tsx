import { useSearchParams } from "react-router";
import Main from "~/components/ui/Main";
import SitePageHeader from "~/components/ui/SitePageHeader";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/Tabs";
import { requireSiteAccess } from "~/lib/auth.server";
import { getDomainMeta } from "~/lib/domainMeta.server";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/route";
import BrandSentiment from "./BrandSentiment";
import CitationsRecentRun from "./CitationsRecentRun";
import TopCompetitors, { topCompetitors } from "./TopCompetitors";
import VisibilityCharts from "./VisibilityCharts";

export const handle = { siteNav: true };

const PLATFORMS = [
  { name: "chatgpt", label: "ChatGPT" },
  { name: "perplexity", label: "Perplexity" },
  { name: "claude", label: "Anthropic" },
  { name: "gemini", label: "Gemini" },
] as const;

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
  const platform = url.searchParams.get("platform") ?? PLATFORMS[0].name;

  const recentRuns = runs.filter((r) => r.platform === platform);
  const queriesForCompetitors = siteQueries
    .map((sq) => {
      for (const r of recentRuns) {
        const found = r.queries.find((q) => q.query === sq.query);
        if (found) return found;
      }
      return null;
    })
    .filter((q) => q !== null);

  const { competitors: rawCompetitors } = topCompetitors(
    queriesForCompetitors,
    site.domain,
  );
  const competitors = await Promise.all(
    rawCompetitors.map(async (c) => ({
      ...c,
      ...(await getDomainMeta(c.domain)),
    })),
  );

  return { site, runs, siteQueries, competitors };
}

export default function SiteCitationsPage({
  loaderData,
}: Route.ComponentProps) {
  const { site, runs, siteQueries, competitors } = loaderData;
  const [searchParams, setSearchParams] = useSearchParams();
  const platform = searchParams.get("platform") ?? PLATFORMS[0].name;
  const recentRuns = runs.filter((r) => r.platform === platform);
  const run = recentRuns[0];

  const mergedQueries = siteQueries
    .map((sq) => {
      for (const r of recentRuns) {
        const found = r.queries.find((q) => q.query === sq.query);
        if (found) return { ...found, onDate: r.onDate };
      }
      return null;
    })
    .filter((q) => q !== null);

  const sentimentRun = recentRuns.find((r) => r.sentimentLabel !== null) ?? run;

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
          defaultValue={platform}
          onValueChange={(platform) => setSearchParams({ platform })}
        >
          <TabsList>
            {PLATFORMS.map((platform) => (
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
            platform={
              PLATFORMS.find((p) => p.name === platform)?.label ??
              "this platform"
            }
            run={sentimentRun}
          />
          <TopCompetitors competitors={competitors} />
          <VisibilityCharts recentRuns={recentRuns} site={site} />
        </>
      ) : (
        <p className="flex items-center justify-center py-8 text-center text-foreground/60 text-lg">
          <span aria-label="sad face" role="img" className="mr-2">
            😔
          </span>
          No runs yet for {PLATFORMS.find((p) => p.name === platform)?.label}.
        </p>
      )}
    </Main>
  );
}
