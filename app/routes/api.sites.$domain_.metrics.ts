import { data } from "react-router";
import { verifySiteAccess } from "~/lib/api/apiAuth.server";
import { SiteMetricsSchema } from "~/lib/api/openapi";
import getSiteMetrics from "~/lib/getSiteMetrics.server";
import type { Route } from "./+types/api.sites.$domain_.metrics";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { id } = await verifySiteAccess({ domain: params.domain, request });
  const [metrics] = await getSiteMetrics({ siteIds: [id] });

  return data(
    SiteMetricsSchema.parse({
      allCitations: {
        current: metrics.allCitations.current,
        previous: metrics.allCitations.previous,
      },
      yourCitations: {
        current: metrics.yourCitations.current,
        previous: metrics.yourCitations.previous,
      },
      visbilityScore: {
        current: metrics.visbilityScore.current,
        previous: metrics.visbilityScore.previous,
      },
      botVisits: {
        current: metrics.botVisits.current,
        previous: metrics.botVisits.previous,
      },
    }),
  );
}
