import { ms } from "convert";
import { parallel } from "radashi";
import invariant from "tiny-invariant";
import captureAndLogError from "~/lib/captureAndLogError.server";
import { isSameDomain, normalizeDomain, normalizeURL } from "~/lib/isSameDomain";
import prisma from "~/lib/prisma.server";
import { checkUsageLimits, recordUsageEvent } from "~/lib/usage/usageLimit.server";
import { isInsufficientCreditError } from "./insufficientCreditError";
import type { QueryFn } from "./queryFn";
import updateRunSentiment from "./updateRunSentiment";

export async function queryPlatform({
  model,
  platform,
  queries,
  queryFn,
  site,
  log,
}: {
  model: string;
  platform: string;
  queries: { query: string; group: string }[];
  queryFn: QueryFn;
  site: { id: string; domain: string; summary: string };
  log: (line: string) => Promise<void> | void;
}) {
  invariant(platform, "Platform is required");
  invariant(model, "Model is required");

  const onDate = new Date().toISOString().split("T")[0];
  const run = await prisma.citationQueryRun.upsert({
    where: { siteId_platform_onDate: { onDate, platform, siteId: site.id } },
    update: { model },
    create: { onDate, model, platform, siteId: site.id },
    select: {
      id: true,
      queries: { select: { query: true } },
      site: true,
      platform: true,
    },
  });

  const notEmptyQueries = queries.filter((q) => q.query.trim());
  const existingQueries = run.queries.map(({ query }) => query);
  const newQueries = notEmptyQueries.filter(({ query }) => !existingQueries.includes(query));
  if (newQueries.length === 0) return;

  const [firstQuery, ...restQueries] = newQueries;

  await log(`${platform}: Probing with first query: ${firstQuery.query}`);
  try {
    await singleQueryRepetition({
      group: firstQuery.group,
      model,
      platform,
      query: firstQuery.query,
      queryFn,
      runId: run.id,
      site,
      log,
    });
  } catch (error) {
    if (isInsufficientCreditError(error)) {
      await log(`${platform}: No credit remaining, skipping platform`);
      if (existingQueries.length === 0)
        await prisma.citationQueryRun.delete({ where: { id: run.id } });
      return;
    }
    captureAndLogError(error, { extra: { siteId: site.id, platform } });
    return;
  }

  if (restQueries.length === 0) {
    await updateRunSentiment({ log, run });
    return;
  }

  let creditExhausted = false;
  await parallel({ limit: 5 }, restQueries, async (query) => {
    if (creditExhausted) return;
    await log(`${platform}: Querying ${query.query} (${query.group})`);
    try {
      await singleQueryRepetition({
        group: query.group,
        model,
        platform,
        query: query.query,
        queryFn,
        runId: run.id,
        site,
        log,
      });
    } catch (error) {
      if (isInsufficientCreditError(error)) {
        creditExhausted = true;
        await log(`${platform}: Credit exhausted mid-run, keeping partial results`);
        return;
      }
      captureAndLogError(error, { extra: { siteId: site.id, platform } });
    }
  });

  await updateRunSentiment({ log, run });
}

export async function singleQueryRepetition({
  group,
  model,
  platform,
  query,
  queryFn,
  runId,
  site,
  log,
}: {
  log: (line: string) => Promise<void> | void;
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
  if (existing) return;

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
  await log(`${platform}: Query complete for ${query} (${group})`);
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
          relationship: isSameDomain({ domain: site.domain, url }) ? "direct" : null,
        };
      }),
      skipDuplicates: true,
    });
  }
}
