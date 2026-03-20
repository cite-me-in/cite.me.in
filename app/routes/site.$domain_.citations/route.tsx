import { useSearchParams } from "react-router";
import Main from "~/components/ui/Main";
import SitePageHeader from "~/components/ui/SitePageHeader";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/Tabs";
import { requireUser } from "~/lib/auth.server";
import prisma from "~/lib/prisma.server";
import { requireSiteAccess } from "~/lib/sites.server";
import type { Route } from "./+types/route";
import CitationsRecentRun from "./CitationsRecentRun";
import TopCompetitors from "./TopCompetitors";
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
  const user = await requireUser(request);
  const site = await requireSiteAccess(params.domain, user.id);

  const runs = await prisma.citationQueryRun.findMany({
    include: { queries: true },
    orderBy: [{ platform: "asc" }, { onDate: "desc" }],
    where: { siteId: site.id },
  });

  return { site, runs };
}

export default function SiteCitationsPage({
  loaderData,
}: Route.ComponentProps) {
  const { site, runs } = loaderData;
  const [searchParams, setSearchParams] = useSearchParams();
  const platform = searchParams.get("platform") ?? PLATFORMS[0].name;
  const recentRuns = runs.filter((r) => r.platform === platform);
  const run = recentRuns[0];

  return (
    <Main variant="wide">
      <SitePageHeader
        site={site}
        title="Citations"
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
          <CitationsRecentRun lastRun={run} site={site} />
          <TopCompetitors queries={run.queries} ownDomain={site.domain} />
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
