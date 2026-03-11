import type { Temporal } from "@js-temporal/polyfill";
import { ms } from "convert";
import debug from "debug";
import captureException from "~/lib/captureException.server";
import prisma from "~/lib/prisma.server";
import {
  checkUsageLimits,
  recordUsageEvent,
} from "~/lib/usage/usageLimit.server";
import type { QueryFn } from "./queryFn";

const logger = debug("server");

/**
 * Query a given platform for a given account and queries.
 *
 * @param modelId - The model to use for the queries.
 * @param newerThan - The date to start querying from. If the last run is *
 *  newer than this date, the queries will not be queried again.
 * @param platform - The platform to query.
 * @param queries - The queries to query.
 * @param queryFn - The function to use to query the LLM.
 * @param site - The site to query.
 */
export default async function queryPlatform({
  accountId,
  modelId,
  newerThan,
  platform,
  queries,
  queryFn,
  site,
}: {
  accountId: string;
  modelId: string;
  newerThan: Temporal.PlainDateTime;
  platform: string;
  queries: { query: string; group: string }[];
  queryFn: QueryFn;
  site: { id: string; domain: string };
}) {
  try {
    const existing = await prisma.citationQueryRun.findFirst({
      where: {
        platform,
        siteId: site.id,
        createdAt: { gte: new Date(`${newerThan.toString()}Z`) },
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      logger(
        "[%s:%s] Skipping — citation query run already exists: %s",
        site.id,
        platform,
        existing.id,
      );
      return;
    }

    const run = await prisma.citationQueryRun.create({
      data: { platform, model: modelId, siteId: site.id },
    });
    logger("[%s:%s] Created citation query run %s", site.id, platform, run.id);

    for (let qi = 0; qi < queries.length; qi++) {
      const query = queries[qi];
      await singleQueryRepetition({
        accountId,
        group: query.group,
        modelId,
        platform,
        query: query.query,
        queryFn,
        runId: run.id,
        site,
      });
    }
  } catch (error) {
    captureException(error, {
      extra: { siteId: site.id, platform },
    });
  }
}

async function singleQueryRepetition({
  accountId,
  group,
  modelId,
  platform,
  query,
  queryFn,
  runId,
  site,
}: {
  accountId: string;
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
    await checkUsageLimits(accountId);
    const { citations, extraQueries, text, usage } = await queryFn({
      maxRetries: 0,
      timeout: ms("10s"),
      query,
    });
    await recordUsageEvent({
      accountId,
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
    captureException(error, {
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
