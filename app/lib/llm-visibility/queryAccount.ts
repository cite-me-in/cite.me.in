import { alphabetical, group, map } from "radashi";
import prisma from "~/lib/prisma.server";
import PLATFORMS from "./platformsToQuery.server";
import { default as runPlatform } from "./queryPlatform";

/**
 * Query all platforms for a given site and queries.
 *
 * @param site - The site to query.
 * @param queries - The queries to query.
 * @returns The results of the queries.
 */
export default async function queryAccount({
  site,
  queries,
}: {
  site: { id: string; domain: string };
  queries: { query: string; group: string }[];
}) {
  await map(PLATFORMS, ({ name: platform, modelId, queryFn }) =>
    runPlatform({
      siteId: site.id,
      modelId,
      platform,
      queries,
      queryFn,
      site,
    }),
  );

  const all = await prisma.citationQueryRun.findMany({
    where: { siteId: site.id },
    include: { queries: true },
    orderBy: { onDate: "asc" },
  });
  const byDate = Object.entries(group(all, ({ onDate }) => onDate));
  return alphabetical(byDate, ([date]) => date);
}
