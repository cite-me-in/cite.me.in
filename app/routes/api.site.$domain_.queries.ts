import { data } from "react-router";
import { verifySiteAccess } from "~/lib/api/apiAuth.server";
import { SiteQueriesSchema } from "~/lib/api/openapi";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/api.site.$domain_.queries";

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
          text: true,
          citations: {
            select: { url: true, relationship: true, reason: true },
          },
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
        ({ model, onDate, platform, queries, sentimentLabel, sentimentSummary }) => ({
          model,
          onDate,
          platform,
          queries: queries.map((query) => ({
            citations: query.citations.map((c) => ({
              url: c.url,
              ...(c.relationship && { relationship: c.relationship }),
              ...(c.reason && { reason: c.reason }),
            })),
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
