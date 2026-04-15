import { ms } from "convert";
import debug from "debug";
import { sleep } from "radashi";
import invariant from "tiny-invariant";
import captureAndLogError from "~/lib/captureAndLogError.server";
import {
  isExactDomain,
  normalizeDomain,
  normalizeUrl,
} from "~/lib/isSameDomain";
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
      select: { id: true, queries: { select: { query: true } } },
    });
    logger("[%s:%s] Created citation query run %s", site.id, platform, run.id);

    const notEmptyQueries = queries.filter((q) => q.query.trim());
    const existingQueries = run.queries.map(({ query }) => query);
    const newQueries = notEmptyQueries.filter(
      ({ query }) => !existingQueries.includes(query),
    );

    if (newQueries.length > 0) {
      for (const [index, query] of newQueries.entries()) {
        if (process.env.NODE_ENV !== "test") await sleep(ms("1s") * index);

        await singleQueryRepetition({
          group: query.group,
          model,
          platform,
          query: query.query,
          queryFn,
          runId: run.id,
          site,
        });
      }

      await updateRunSentiment({ site, platform, runId: run.id });
      await upsertCitedPages({
        siteId: site.id,
        runId: run.id,
        domain: site.domain,
      });
    }
  } catch (error) {
    captureAndLogError(error, {
      extra: { siteId: site.id, platform },
    });
  }
}

async function updateRunSentiment({
  site,
  platform,
  runId,
}: {
  site: { id: string; domain: string; summary: string };
  platform: string;
  runId: string;
}) {
  try {
    const completedQueries = await prisma.citationQuery.findMany({
      where: { runId },
      select: {
        query: true,
        text: true,
        citations: { select: { url: true, relationship: true } },
      },
    });
    const { label, summary, citations } = await analyzeSentiment({
      domain: site.domain,
      queries: completedQueries.map((q) => ({
        query: q.query,
        text: q.text,
        citations: q.citations
          .filter((c) => c.relationship === null)
          .map((c) => c.url),
      })),
      siteSummary: site.summary,
    });
    await prisma.citationQueryRun.update({
      where: { id: runId },
      data: { sentimentLabel: label, sentimentSummary: summary },
    });

    for (const c of citations) {
      await prisma.citation.updateMany({
        where: { siteId: site.id, runId, url: c.url, relationship: null },
        data: { relationship: c.relationship, reason: c.reason ?? null },
      });
    }

    logger("[%s:%s] Sentiment analysis complete: %s", site.id, platform, label);
  } catch (sentimentError) {
    captureAndLogError(sentimentError, {
      extra: { siteId: site.id, platform, runId },
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
          const url = normalizeUrl(rawUrl);
          return {
            url,
            domain: normalizeDomain(url),
            queryId: citationRecord.id,
            runId,
            siteId: site.id,
            relationship: isExactDomain({ domain: site.domain, url })
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
