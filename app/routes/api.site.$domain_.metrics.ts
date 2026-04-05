import type { Route } from "./+types/api.site.$domain_.metrics";
import { SiteMetricsSchema } from "~/lib/api/openapi";
import { verifySiteAccess } from "~/lib/api/apiAuth.server";
import { data } from "react-router";
import getSiteMetrics from "~/lib/getSiteMetrics.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { id } = await verifySiteAccess({ domain: params.domain, request });
  const [metrics] = await getSiteMetrics({ siteIds: [id] });

  return data(
    SiteMetricsSchema.parse({
      allCitations: metrics.allCitations,
      yourCitations: metrics.yourCitations,
      visbilityScore: metrics.visbilityScore,
      botVisits: metrics.botVisits,
    }),
  );
}
