import { ms } from "convert";
import debug from "debug";
import { delay, forEachAsync } from "es-toolkit";
import logError from "~/lib/logError.server";
import prisma from "~/lib/prisma.server";
import {
  checkUsageLimits,
  recordUsageEvent,
} from "~/lib/usage/usageLimit.server";
import analyzeSentiment from "./analyzeSentiment";
import type { QueryFn } from "./queryFn";

const logger = debug("server");

/**
 * Query a given platform for a given account and queries.
 *
 * @param modelId - The model to use for the queries.
 * @param platform - The platform to query.
 * @param queries - The queries to query.
 * @param queryFn - The function to use to query the LLM.
 * @param site - The site to query.
 */
export default async function queryPlatform({
  siteId,
  modelId,
  platform,
  queries,
  queryFn,
  site,
}: {
  siteId: string;
  modelId: string;
  platform: string;
  queries: { query: string; group: string }[];
  queryFn: QueryFn;
  site: { id: string; domain: string };
}) {
  try {
    const onDate = new Date().toISOString().split("T")[0];
    const run = await prisma.citationQueryRun.upsert({
      where: { siteId_platform_onDate: { onDate, platform, siteId: site.id } },
      update: { model: modelId },
      create: { onDate, model: modelId, platform, siteId: site.id },
    });
    logger("[%s:%s] Created citation query run %s", site.id, platform, run.id);

    await forEachAsync(queries, async (query, index) => {
      if (process.env.NODE_ENV !== "test") await delay(ms("1s") * index);
      return singleQueryRepetition({
        siteId,
        group: query.group,
        modelId,
        platform,
        query: query.query,
        queryFn,
        runId: run.id,
        site,
      });
    });

    await updateRunSentiment({ site, platform, runId: run.id });
  } catch (error) {
    logError(error, {
      extra: { siteId: site.id, platform },
    });
  }
}

export async function updateRunSentiment({
  site,
  platform,
  runId,
}: {
  site: { id: string; domain: string };
  platform: string;
  runId: string;
}) {
  try {
    const completedQueries = await prisma.citationQuery.findMany({
      where: { runId },
    });
    const { label, summary } = await analyzeSentiment({
      domain: site.domain,
      queries: completedQueries,
    });
    await prisma.citationQueryRun.update({
      where: { id: runId },
      data: { sentimentLabel: label, sentimentSummary: summary },
    });
    logger("[%s:%s] Sentiment analysis complete: %s", site.id, platform, label);
  } catch (sentimentError) {
    logError(sentimentError, {
      extra: { siteId: site.id, platform, runId },
    });
  }
}

export async function singleQueryRepetition({
  siteId,
  group,
  modelId,
  platform,
  query,
  queryFn,
  runId,
  site,
}: {
  siteId: string;
  group: string;
  modelId: string;
  platform: string;
  query: string;
  queryFn: QueryFn;
  runId: string;
  site: { id: string; domain: string };
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
    await checkUsageLimits(siteId);
    const { citations, extraQueries, text, usage } = await queryFn({
      maxRetries: 3,
      timeout: ms("60s"),
      query,
    });
    await recordUsageEvent({
      siteId,
      model: modelId,
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
    });
    logger("[%s:%s] %s (group: %s)", site.id, platform, query, group);
    const index = citations.findIndex(
      (url) => new URL(url).hostname === site.domain,
    );

    await prisma.citationQuery.create({
      data: {
        group,
        citations,
        extraQueries,
        position: index >= 0 ? index : null,
        query,
        runId,
        text,
      },
    });
  } catch (error) {
    console.error(error);
    logError(error, {
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
