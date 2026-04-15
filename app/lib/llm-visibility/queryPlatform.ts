import { ms } from "convert";
import debug from "debug";
import { parallel } from "radashi";
import invariant from "tiny-invariant";
import captureAndLogError from "~/lib/captureAndLogError.server";
import {
  isSameDomain,
  normalizeDomain,
  normalizeURL,
} from "~/lib/isSameDomain";
import prisma from "~/lib/prisma.server";
import {
  checkUsageLimits,
  recordUsageEvent,
} from "~/lib/usage/usageLimit.server";
import type { QueryFn } from "./queryFn";
import updateRunSentiment from "./updateRunSentiment";

export const logger = debug("server");

/**
 * Query a given platform for a given account and queries.
 *
 * @param model - The model to use for the queries.
 * @param platform - The platform to query.
 * @param queries - The queries to query.
 * @param queryFn - The function to use to query the LLM.
 * @param site - The site to query.
 */
export async function queryPlatform({
  model,
  platform,
  queries,
  queryFn,
  site,
}: {
  model: string;
  platform: string;
  queries: { query: string; group: string }[];
  queryFn: QueryFn;
  site: { id: string; domain: string; summary: string };
}) {
  invariant(platform, "Platform is required");
  invariant(model, "Model is required");

  try {
    const onDate = new Date().toISOString().split("T")[0];
    const run = await prisma.citationQueryRun.upsert({
      where: { siteId_platform_onDate: { onDate, platform, siteId: site.id } },
      update: { model: model },
      create: { onDate, model: model, platform, siteId: site.id },
      select: {
        id: true,
        queries: { select: { query: true } },
        site: true,
        platform: true,
      },
    });
    logger("[%s:%s] Created citation query run %s", site.id, platform, run.id);

    const notEmptyQueries = queries.filter((q) => q.query.trim());
    const existingQueries = run.queries.map(({ query }) => query);
    const newQueries = notEmptyQueries.filter(
      ({ query }) => !existingQueries.includes(query),
    );
    if (newQueries.length === 0) return;

    await parallel({ limit: 5 }, newQueries, async (query) => {
      await singleQueryRepetition({
        group: query.group,
        model,
        platform,
        query: query.query,
        queryFn,
        runId: run.id,
        site,
      });
    });

    await updateRunSentiment(run);
    await upsertCitedPages({
      siteId: site.id,
      runId: run.id,
      domain: site.domain,
    });
  } catch (error) {
    captureAndLogError(error, {
      extra: { siteId: site.id, platform },
    });
  }
}

export async function upsertCitedPages({
  siteId,
  runId,
  domain,
}: {
  siteId: string;
  runId: string;
  domain: string;
}) {
  const ownCitations = await prisma.citation.findMany({
    where: { runId, siteId, domain },
    select: { url: true },
  });

  const urlCounts = new Map<string, number>();
  for (const { url } of ownCitations)
    urlCounts.set(url, (urlCounts.get(url) ?? 0) + 1);

  for (const [url, count] of urlCounts) {
    await prisma.citedPage.upsert({
      where: { siteId_url: { siteId, url } },
      create: { url, siteId, citationCount: count },
      update: { citationCount: { increment: count } },
    });
  }
}

export async function singleQueryRepetition({
  group,
  model,
  platform,
  query,
  queryFn,
  runId,
  site,
}: {
  group: string;
  model: string;
  platform: string;
  query: string;
  queryFn: QueryFn;
  runId: string;
  site: { id: string; domain: string; summary: string };
}): Promise<void> {
  const existing = await prisma.citationQuery.findFirst({
    where: { query, runId },
  });
  if (existing) {
    logger(
      "[%s:%s] %s (group: %s) — already exists",
      site.id,
      platform,
      query,
      group,
    );
    return;
  }

  try {
    await checkUsageLimits(site.id);
    const { citations, extraQueries, text, usage } = await queryFn({
      maxRetries: 3,
      timeout: ms("60s"),
      query,
    });
    await recordUsageEvent({
      siteId: site.id,
      model,
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
    });
    logger("[%s:%s] %s (group: %s)", site.id, platform, query, group);
    const citationRecord = await prisma.citationQuery.create({
      data: {
        group,
        extraQueries,
        query,
        runId,
        text,
      },
    });

    if (citations.length > 0) {
      await prisma.citation.createMany({
        data: citations.map((rawUrl) => {
          const url = normalizeURL(rawUrl);
          return {
            url,
            domain: normalizeDomain(url),
            queryId: citationRecord.id,
            runId,
            siteId: site.id,
            relationship: isSameDomain({ domain: site.domain, url })
              ? "exact"
              : null,
          };
        }),
        skipDuplicates: true,
      });
    }
  } catch (error) {
    captureAndLogError(error, {
      extra: {
        siteId: site.id,
        platform,
        runId,
        query,
        group,
      },
    });
  }
}
