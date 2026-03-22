import { data } from "react-router";
import { verifySiteAccess } from "~/lib/api/apiAuth.server";
import { RunDetailSchema } from "~/lib/api/schemas";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/api.sites.$domain_.runs.$runId";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { id } = await verifySiteAccess({ domain: params.domain, request });

  const run = await prisma.citationQueryRun.findFirst({
    where: { id: params.runId, siteId: id },
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
          position: true,
          citations: true,
        },
        orderBy: { query: "asc" },
      },
    },
  });

  if (!run) throw new Response("Not found", { status: 404 });
  return data(
    RunDetailSchema.parse({
      id: run.id,
      model: run.model,
      onDate: run.onDate,
      platform: run.platform,
      queries: run.queries.map((query) => ({
        id: query.id,
        query: query.query,
        group: query.group,
        position: query.position,
        citations: query.citations,
      })),
    }),
  );
}
