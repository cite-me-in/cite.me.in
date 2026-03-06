import { useSearchParams } from "react-router";
import SitePageHeader from "~/components/ui/SitePageHeader";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/Tabs";
import { requireUser } from "~/lib/auth.server";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/route";
import RecentVisibility from "./RecentVisibility";
import VisibilityCharts from "./VisibilityCharts";

export const handle = { siteNav: true };

const PLATFORMS = [
  { name: "chatgpt", label: "ChatGPT" },
  { name: "perplexity", label: "Perplexity" },
  { name: "claude", label: "Anthropic" },
  { name: "gemini", label: "Gemini" },
] as const;

export function meta({ data }: Route.MetaArgs) {
  return [{ title: `Citations — ${data?.site.domain} | CiteUp` }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const site = await prisma.site.findFirst({
    where: { id: params.id, accountId: user.accountId },
  });
  if (!site) throw new Response("Not found", { status: 404 });

  const runs = await prisma.citationQueryRun.findMany({
    include: { queries: true },
    orderBy: { createdAt: "desc" },
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
  const run = runs.find((r) => r.platform === platform);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-6 py-12">
      <SitePageHeader
        site={site}
        title="Citations"
        backTo={{ label: "Edit queries", path: `/site/${site.id}/queries` }}
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
          <RecentVisibility run={run} />
          <VisibilityCharts
            runs={runs.filter((r) => r.platform === platform)}
          />
        </>
      ) : (
        <p className="flex items-center justify-center py-8 text-center text-foreground/60 text-lg">
          <span aria-label="sad face" role="img" className="mr-2">
            😔
          </span>
          No runs yet for {PLATFORMS.find((p) => p.name === platform)?.label}.
        </p>
      )}
    </main>
  );
}
