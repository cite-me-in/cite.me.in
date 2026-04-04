import type { Route } from "./+types/api.site.$domain_.queries";
import { SiteQueriesSchema } from "~/lib/api/openapi";
import { verifySiteAccess } from "~/lib/api/apiAuth.server";
import { data } from "react-router";
import prisma from "~/lib/prisma.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { id } = await verifySiteAccess({ domain: params.domain, request });

  const platforms = await prisma.citationQueryRun.findMany({
    distinct: ["platform", "onDate"],
    where: { siteId: id },
    select: {
      id: true,
      platform: true,
      model: true,
      onDate: true,
      queries: {
        select: {
          id: true,
          query: true,
          group: true,
          citations: true,
          text: true,
        },
        orderBy: { query: "asc" },
      },
      sentimentLabel: true,
      sentimentSummary: true,
    },
  });

  return data(
    SiteQueriesSchema.parse({
      platforms: platforms.map(
        ({
          model,
          onDate,
          platform,
          queries,
          sentimentLabel,
          sentimentSummary,
        }) => ({
          model,
          onDate,
          platform,
          queries: queries.map((query) => ({
            citations: query.citations,
            group: query.group,
            query: query.query,
            response: query.text,
          })),
          sentiment: {
            label: sentimentLabel ?? "neutral",
            summary: sentimentSummary ?? "No sentiment analysis available.",
          },
        }),
      ),
    }),
  );
}
