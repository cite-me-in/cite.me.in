import type { Temporal } from "@js-temporal/polyfill";
import { captureException } from "@sentry/react-router";
import { ms } from "convert";
import debug from "debug";
import { delay } from "es-toolkit";
import prisma from "~/lib/prisma.server";
import type { QueryFn } from "./llmVisibility";

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
 * @param repetitions - The number of times to repeat each query. If the last *
 *  query is newer than this date, the queries will not be queried again.
 * @param site - The site to query.
 */
export default async function queryPlatform({
  modelId,
  newerThan,
  platform,
  queries,
  queryFn,
  repetitions,
  site,
}: {
  modelId: string;
  newerThan: Temporal.PlainDateTime;
  platform: string;
  queries: { query: string; category: string }[];
  queryFn: QueryFn;
  repetitions: number;
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
      for (let repetition = 1; repetition <= repetitions; repetition++) {
        await singleQueryRepetition({
          site,
          category: query.category,
          platform,
          query: query.query,
          queryFn,
          repetition,
          runId: run.id,
        });
        await delay(ms("2s"));
      }
    }
  } catch (error) {
    logger("[%s:%s] Error: %s", site.id, platform, error);
    captureException(error, {
      extra: { siteId: site.id, platform },
    });
  }
}

async function singleQueryRepetition({
  category,
  platform,
  query,
  queryFn,
  repetition,
  runId,
  site,
}: {
  category: string;
  platform: string;
  query: string;
  queryFn: QueryFn;
  repetition: number;
  runId: string;
  site: { id: string; domain: string };
}): Promise<void> {
  const existing = await prisma.citationQuery.findFirst({
    where: { query, repetition, runId },
  });
  if (existing) {
    logger(
      "[%s:%s] Repetition %d: %s (category: %s) — already exists",
      site.id,
      platform,
      repetition,
      query,
      category,
    );
    return;
  }

  try {
    const { citations, extraQueries, text } = await queryFn(query);
    logger(
      "[%s:%s] Repetition %d: %s (category: %s)",
      site.id,
      platform,
      repetition,
      query,
      category,
    );
    const index = citations.findIndex(
      (url) => new URL(url).hostname === site.domain,
    );

    await prisma.citationQuery.create({
      data: {
        category,
        citations,
        extraQueries,
        position: index >= 0 ? index : null,
        query,
        repetition,
        runId,
        text,
      },
    });
  } catch (error) {
    logger(
      "[%s:%s] Repetition %d: %s (category: %s) — error: %s",
      site.id,
      platform,
      repetition,
      query,
      category,
      error,
    );
    captureException(error, {
      extra: {
        siteId: site.id,
        platform,
        runId,
        query,
        category,
        repetition,
      },
    });
  }
}
