import { sumBy } from "es-toolkit";
import { data } from "react-router";
import { verifySiteAccess } from "~/lib/api/apiAuth.server";
import { RunsSchema } from "~/lib/api/schemas";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/api.sites.$domain_.runs";

export async function loader({ request, params }: Route.LoaderArgs) {
  const site = await verifySiteAccess({ domain: params.domain, request });

  const url = new URL(request.url);
  const since = url.searchParams.get("since");
  const sinceDate = since ? new Date(since) : undefined;

  const runs = await prisma.citationQueryRun.findMany({
    where: {
      siteId: site.id,
      ...(sinceDate ? { createdAt: { gte: sinceDate } } : {}),
    },
    select: {
      id: true,
      platform: true,
      model: true,
      createdAt: true,
      queries: { select: { citations: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return data(
    RunsSchema.parse({
      runs: runs.map(({ queries, ...run }) => ({
        id: run.id,
        platform: run.platform,
        model: run.model,
        completedAt: run.createdAt.toISOString().split("T")[0],
        queryCount: queries.length,
        citationCount: sumBy(queries, (q) => q.citations.length),
      })),
    }),
  );
}
