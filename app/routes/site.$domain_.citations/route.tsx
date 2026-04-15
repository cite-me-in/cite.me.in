import { alphabetical, unique } from "radashi";
import { useSearchParams } from "react-router";
import Main from "~/components/ui/Main";
import SitePageHeader from "~/components/ui/SiteHeading";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/Tabs";
import { requireSiteAccess } from "~/lib/auth.server";
import { getCitationGaps } from "~/lib/citationGapAnalysis.server";
import { getDomainMeta } from "~/lib/domainMeta.server";
import { normalizeUrl } from "~/lib/isSameDomain";
import PLATFORMS from "~/lib/llm-visibility/platforms";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/route";
import BrandSentiment from "./BrandSentiment";
import CitationGapAnalysis from "./CitationGapAnalysis";
import CitationsRecentRun from "./CitationsRecentRun";
import RelatedCitations, { INDIRECT_CITATION_WEIGHT } from "./RelatedCitations";
import TopCompetitors, { topCompetitors } from "./TopCompetitors";
import VisibilityCharts from "./VisibilityCharts";

export const handle = { siteNav: true };

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `Citations — ${loaderData?.site.domain} | Cite.me.in` }];
}

type Citation = {
  url: string;
  domain: string;
  relationship: string | null;
  reason: string | null;
  runId: string;
  queryId: string;
};

function classifyCitations(citations: Citation[]) {
  const exact = citations.filter((c) => c.relationship === "exact");
  const direct = citations.filter((c) => c.relationship === "direct");
  const indirect = citations.filter((c) => c.relationship === "indirect");
  return { exact, direct, indirect };
}

function buildClassifiedUrls(citations: Citation[]): Set<string> {
  return new Set(
    citations
      .filter(
        (c) =>
          c.relationship === "exact" ||
          c.relationship === "direct" ||
          c.relationship === "indirect",
      )
      .map((c) => c.url),
  );
}

function computeShareOfVoice(
  exactCitations: Citation[],
  directCitations: Citation[],
  indirectCitations: Citation[],
  total: number,
) {
  const exactUrls = new Set(exactCitations.map((c) => normalizeUrl(c.url)));
  const directUrls = new Set(
    directCitations
      .map((c) => normalizeUrl(c.url))
      .filter((u) => !exactUrls.has(u)),
  );
  const indirectUrls = new Set(
    indirectCitations
      .map((c) => normalizeUrl(c.url))
      .filter((u) => !exactUrls.has(u) && !directUrls.has(u)),
  );

  const directCount = exactUrls.size + directUrls.size;
  const indirectCount = indirectUrls.size;
  const weightedCitations =
    directCount + indirectCount * INDIRECT_CITATION_WEIGHT;

  return {
    exactUrls,
    directUrls,
    indirectUrls,
    directCount,
    indirectCount,
    shareOfVoice: {
      count: weightedCitations,
      pct: total > 0 ? Math.round((weightedCitations / total) * 100) : 0,
      breakdown: {
        direct: directCount,
        indirect: indirectCount,
      },
    },
  };
}

function buildRelatedCitations(
  exactUrls: Set<string>,
  directUrls: Set<string>,
  indirectUrls: Set<string>,
  directCitations: Citation[],
  indirectCitations: Citation[],
) {
  return {
    exact: [...exactUrls],
    direct: [...directUrls].map((url) => ({
      url,
      reason:
        directCitations.find((c) => normalizeUrl(c.url) === url)?.reason ??
        null,
    })),
    indirect: [...indirectUrls].map((url) => ({
      url,
      reason:
        indirectCitations.find((c) => normalizeUrl(c.url) === url)?.reason ??
        null,
    })),
  };
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { site } = await requireSiteAccess({ domain: params.domain, request });

  const [runs, siteQueries, citationRows] = await Promise.all([
    prisma.citationQueryRun.findMany({
      select: {
        id: true,
        onDate: true,
        platform: true,
        model: true,
        siteId: true,
        sentimentLabel: true,
        sentimentSummary: true,
        queries: {
          select: {
            id: true,
            group: true,
            query: true,
            text: true,
            extraQueries: true,
            runId: true,
            createdAt: true,
            citations: { select: { url: true, relationship: true } },
          },
        },
      },
      orderBy: [{ platform: "asc" }, { onDate: "desc" }],
      where: { siteId: site.id },
    }),
    prisma.siteQuery.findMany({
      where: { siteId: site.id },
      orderBy: [{ group: "asc" }, { query: "asc" }],
    }),
    prisma.citation.findMany({
      where: { siteId: site.id },
      select: {
        url: true,
        domain: true,
        relationship: true,
        reason: true,
        runId: true,
        queryId: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const url = new URL(request.url);
  const platform =
    PLATFORMS.find((p) => p.name === url.searchParams.get("platform")) ??
    PLATFORMS[0];

  const recentRuns = runs.filter((r) => r.platform === platform.name);
  const recentRunIds = new Set(recentRuns.map((r) => r.id));
  const recentCitations = citationRows.filter((c) => recentRunIds.has(c.runId));

  const {
    exact: exactCitations,
    direct: directCitations,
    indirect: indirectCitations,
  } = classifyCitations(recentCitations);

  const classifiedUrls = buildClassifiedUrls(recentCitations);

  const citationQueryMap = new Map(
    runs.flatMap((r) =>
      r.queries.map((q) => [q.id, { id: q.id, query: q.query }]),
    ),
  );
  const gaps = getCitationGaps({
    citations: recentCitations.map(({ url, domain, queryId }) => ({
      url,
      domain,
      queryId,
    })),
    queries: [...citationQueryMap.values()],
    ownDomain: site.domain,
  });

  const { competitors: rawCompetitors, total } = topCompetitors(
    recentCitations.map(({ url, domain }) => ({ url, domain })),
    site.domain,
    classifiedUrls,
  );
  const competitors = await Promise.all(
    rawCompetitors.map(async (c) => ({
      ...c,
      ...(await getDomainMeta(c.domain)),
    })),
  );

  const { exactUrls, directUrls, indirectUrls, shareOfVoice } =
    computeShareOfVoice(
      exactCitations,
      directCitations,
      indirectCitations,
      total,
    );

  const relatedCitations = buildRelatedCitations(
    exactUrls,
    directUrls,
    indirectUrls,
    directCitations,
    indirectCitations,
  );

  return {
    site,
    runs,
    siteQueries,
    competitors,
    gaps,
    classifications: recentCitations,
    shareOfVoice,
    relatedCitations,
  };
}

export default function SiteCitationsPage({
  loaderData,
}: Route.ComponentProps) {
  const {
    site,
    runs,
    siteQueries,
    competitors,
    gaps,
    classifications,
    shareOfVoice,
    relatedCitations,
  } = loaderData;
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
          <CitationsRecentRun
            queries={mergedQueries}
            meta={run}
            site={site}
            classifications={relatedCitations}
          />
          <BrandSentiment
            sentiment={sentiment}
            platformLabel={platform.label}
          />
          <RelatedCitations relatedCitations={relatedCitations} />
          <TopCompetitors
            competitors={competitors}
            shareOfVoice={shareOfVoice}
          />
          <CitationGapAnalysis gaps={gaps} />
          <VisibilityCharts
            recentRuns={recentRuns}
            site={site}
            classifications={classifications}
          />
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
