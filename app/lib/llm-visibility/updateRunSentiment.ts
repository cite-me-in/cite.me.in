import captureAndLogError from "~/lib/captureAndLogError.server";
import prisma from "~/lib/prisma.server";
import type { Prisma } from "~/prisma";
import analyzeSentiment from "./analyzeSentiment";

/**
 * Update the sentiment analysis for a given run.
 *
 * @param run - The run to update the sentiment analysis for.
 * @param log - The log function to use.
 */
export default async function updateRunSentiment({
  log,
  run,
}: {
  log: (line: string) => Promise<void> | void;
  run: Prisma.CitationQueryRunGetPayload<{
    select: {
      id: true;
      queries: { select: { query: true } };
      site: true;
      platform: true;
    };
  }>;
}): Promise<void> {
  try {
    await log(`Updating sentiment for ${run.site.domain} on ${run.platform}`);
    const completedQueries = await prisma.citationQuery.findMany({
      where: { runId: run.id },
      select: {
        query: true,
        text: true,
        citations: { select: { url: true, relationship: true } },
      },
    });

    const { label, summary, citations } = await analyzeSentiment({
      domain: run.site.domain,
      queries: completedQueries.map((q) => ({
        query: q.query,
        text: q.text,
        citations: q.citations
          .filter((c) => c.relationship === null)
          .map((c) => c.url),
      })),
      siteSummary: run.site.summary,
    });

    await prisma.citationQueryRun.update({
      where: { id: run.id },
      data: { sentimentLabel: label, sentimentSummary: summary },
    });

    for (const citation of citations) {
      await prisma.citation.updateMany({
        where: {
          siteId: run.site.id,
          runId: run.id,
          url: citation.url,
          relationship: null,
        },
        data: {
          relationship: citation.relationship,
          reason: citation.reason ?? null,
        },
      });
    }

    await log(
      `Sentiment analysis complete: ${label} for ${run.site.domain} on ${run.platform}`,
    );
  } catch (sentimentError) {
    captureAndLogError(sentimentError, {
      extra: { run },
    });
  }
}
