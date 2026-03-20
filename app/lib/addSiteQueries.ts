import { differenceBy, forEachAsync, uniqBy } from "es-toolkit";
import type { Site } from "~/prisma";
import queryClaude from "./llm-visibility/claudeClient";
import queryGemini from "./llm-visibility/geminiClient";
import openaiClient from "./llm-visibility/openaiClient";
import queryPerplexity from "./llm-visibility/perplexityClient";
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
}

export async function addSiteQueryGroup(site: Site, group: string) {
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
  site: Site;
  oldGroup: string;
  newGroup: string;
}) {
  await prisma.siteQuery.updateMany({
    where: { siteId: site.id, group: trimQuery(oldGroup) },
    data: { group: trimQuery(newGroup) },
  });
}

const PLATFORMS = [
  { platform: "chatgpt", modelId: "gpt-5-chat-latest", queryFn: openaiClient },
  { platform: "perplexity", modelId: "sonar", queryFn: queryPerplexity },
  {
    platform: "claude",
    modelId: "claude-haiku-4-5-20251001",
    queryFn: queryClaude,
  },
  { platform: "gemini", modelId: "gemini-2.5-flash", queryFn: queryGemini },
] as const;

export async function runQueryOnAllPlatforms({
  site,
  query,
  group,
}: {
  site: { id: string; domain: string };
  query: string;
  group: string;
}) {
  await forEachAsync(PLATFORMS, async ({ platform, modelId, queryFn }) => {
    const createdAt = new Date().toISOString();
    const run = await prisma.citationQueryRun.upsert({
      where: {
        siteId_platform_createdAt: { createdAt, platform, siteId: site.id },
      },
      update: { model: modelId },
      create: { createdAt, model: modelId, platform, siteId: site.id },
    });

    await singleQueryRepetition({
      siteId: site.id,
      group,
      modelId,
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
