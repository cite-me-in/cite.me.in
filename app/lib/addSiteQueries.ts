import { differenceBy, uniqBy } from "es-toolkit";
import type { Site } from "~/prisma";
import queryAccount from "./llm-visibility/queryAccount";
import prisma from "./prisma.server";

/**
 * Add queries to a site. Only adds queries that are not already present,
 * removes duplicates, and does a citation query run on the new queries.
 *
 * @param site - The site to add queries to.
 * @param queries - The queries to add.
 * @returns The created queries.
 */
export default async function addSiteQueries(
  site: Site,
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
  const unique = differenceBy(
    uniqBy(trimmed, (q) => `${q.group}:${q.query}`),
    existing,
    (q) => `${q.group}:${q.query}`,
  );
  // Add the new queries to the database.
  await prisma.siteQuery.createMany({
    data: unique.map(({ group, query }) => ({ siteId: site.id, group, query })),
  });
  // Inspect LLM visibility for the new queries we just added.
  await queryAccount({ site, queries: unique });
}

export async function addSiteQueryGroup(site: Site, group: string) {
  await prisma.siteQuery.create({
    data: { siteId: site.id, group: trimQuery(group), query: "" },
  });
}

/**
 * Update a query for a site. Does a citation query run on the new query.
 *
 * @param id - The id of the query to update.
 * @param query - The new query.
 * @returns The updated query.
 */
export async function updateSiteQuery(id: string, query: string) {
  const updated = await prisma.siteQuery.update({
    data: { query: trimQuery(query) },
    include: { site: true },
    where: { id },
  });
  await queryAccount({ queries: [updated], site: updated.site });
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
  site: Site;
  oldGroup: string;
  newGroup: string;
}) {
  await prisma.siteQuery.updateMany({
    where: { siteId: site.id, group: trimQuery(oldGroup) },
    data: { group: trimQuery(newGroup) },
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
