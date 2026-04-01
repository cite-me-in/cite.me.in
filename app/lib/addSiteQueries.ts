import { diff, map, unique } from "radashi";
import PLATFORMS from "./llm-visibility/platformsToQuery.server";
import { singleQueryRepetition } from "./llm-visibility/queryPlatform";
import prisma from "./prisma.server";

/**
 * Add queries to a site. Only adds queries that are not already present
 * and removes duplicates.
 *
 * @param site - The site to add queries to.
 * @param queries - The queries to add.
 * @returns The created queries.
 */
export default async function addSiteQueries(
  site: { id: string; domain: string },
  queries: { group: string; query: string }[],
) {
  // Get existing queries for the site so we can ignore them.
  const existing = await prisma.siteQuery.findMany({
    where: { siteId: site.id },
  });
  // Trim the queries so they don't have extra whitespace.
  const trimmed = queries.map(({ group, query }) => ({
    group: trimQuery(group),
    query: trimQuery(query),
  }));
  // Remove duplicates from the input and from the existing queries.
  const uniqueQueries = diff(
    unique(trimmed, (q) => `${q.group}:${q.query}`),
    existing,
    (q) => `${q.group}:${q.query}`,
  );
  // Add the new queries to the database.
  await prisma.siteQuery.createMany({
    data: uniqueQueries.map(({ group, query }) => ({
      siteId: site.id,
      group,
      query,
    })),
  });
}

export async function addSiteQueryGroup(
  site: { id: string; domain: string },
  group: string,
) {
  await prisma.siteQuery.create({
    data: { siteId: site.id, group: trimQuery(group), query: "" },
  });
}

/**
 * Update a query for a site.
 *
 * @param id - The id of the query to update.
 * @param query - The new query.
 */
export async function updateSiteQuery(id: string, query: string) {
  await prisma.siteQuery.update({
    data: { query: trimQuery(query) },
    where: { id },
  });
}

/**
 * Rename a group of queries for a site.
 *
 * @param site - The site to rename the group for.
 * @param oldGroup - The old group name.
 * @param newGroup - The new group name.
 */
export async function renameSiteQueryGroup({
  site,
  oldGroup,
  newGroup,
}: {
  site: { id: string; domain: string };
  oldGroup: string;
  newGroup: string;
}) {
  await prisma.siteQuery.updateMany({
    where: { siteId: site.id, group: trimQuery(oldGroup) },
    data: { group: trimQuery(newGroup) },
  });
}

export async function runQueryOnAllPlatforms({
  site,
  query,
  group,
}: {
  site: { id: string; domain: string };
  query: string;
  group: string;
}) {
  await map(PLATFORMS, async ({ name: platform, model, queryFn }) => {
    const onDate = new Date().toISOString().split("T")[0];
    const run = await prisma.citationQueryRun.upsert({
      where: {
        siteId_platform_onDate: { onDate, platform, siteId: site.id },
      },
      update: { model },
      create: { onDate, model, platform, siteId: site.id },
    });

    await singleQueryRepetition({
      group,
      model,
      platform,
      query: query.trim().replace(/\s+/g, " "),
      queryFn,
      runId: run.id,
      site,
    });
  });
}

/**
 * Trim a query so it doesn't have extra whitespace. "  1.  many spaces  " -> "1. many spaces"
 *
 * @param query - The query to trim.
 * @returns The trimmed query.
 */
function trimQuery(query: string) {
  return query.trim().replace(/\s+/g, " ");
}
