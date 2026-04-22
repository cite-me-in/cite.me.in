import { data } from "react-router";
import { verifySiteAccess } from "~/lib/api/apiAuth.server";
import { SiteMetricsSchema } from "~/lib/api/openapi";
import getSiteMetrics from "~/lib/getSiteMetrics.server";
import type { Route } from "./+types/api.site.$domain_.metrics";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { id } = await verifySiteAccess({ domain: params.domain, request });
  const [metrics] = await getSiteMetrics({ siteIds: [id] });

  return data(
    SiteMetricsSchema.parse({
      allCitations: metrics.allCitations,
      yourCitations: metrics.yourCitations,
      visbilityScore: metrics.visbilityScore,
      queryCoverageRate: metrics.queryCoverageRate,
    }),
  );
}
