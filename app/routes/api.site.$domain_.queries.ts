import type { Route } from "./+types/api.site.$domain_.queries";
import { SiteQueriesSchema } from "~/lib/api/openapi";
import { verifySiteAccess } from "~/lib/api/apiAuth.server";
import { data } from "react-router";
import prisma from "~/lib/prisma.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { id } = await verifySiteAccess({ domain: params.domain, request });

  const [platforms, classifications] = await Promise.all([
    prisma.citationQueryRun.findMany({
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
    }),
    prisma.citationClassification.findMany({
      where: { siteId: id },
      select: { url: true, relationship: true, reason: true, runId: true },
    }),
  ]);

  const classificationMap = new Map(
    classifications.map((c) => [
      `${c.runId}:${c.url}`,
      { relationship: c.relationship, reason: c.reason },
    ]),
  );

  return data(
    SiteQueriesSchema.parse({
      platforms: platforms.map(
        ({
          id: runId,
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
            citations: query.citations.map((url) => {
              const classified = classificationMap.get(`${runId}:${url}`);
              return {
                url,
                ...(classified?.relationship && {
                  relationship: classified.relationship,
                }),
                ...(classified?.reason && { reason: classified.reason }),
              };
            }),
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
