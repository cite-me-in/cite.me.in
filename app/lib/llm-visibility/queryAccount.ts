import { Temporal } from "@js-temporal/polyfill";
import { groupBy, orderBy } from "es-toolkit";
import prisma from "~/lib/prisma.server";
import type { Site } from "~/prisma";
import queryClaude from "./claudeClient";
import queryGemini from "./geminiClient";
import openaiClient from "./openaiClient";
import queryPerplexity from "./perplexityClient";
import {
  default as runAllQueries,
  default as runPlatform,
} from "./queryPlatform";

/**
 * Query all platforms for a given site and queries.
 *
 * @param site - The site to query.
 * @param queries - The queries to query.
 * @param repetitions - The number of times to repeat each query. Defaults to 1.
 * @returns The results of the queries.
 */
export default async function queryAccount({
  site,
  queries,
  repetitions = 1,
}: {
  site: Site;
  queries: { query: string; category: string }[];
  repetitions?: number;
}) {
  const newerThan = Temporal.Now.instant()
    .subtract({ hours: 24 })
    .toZonedDateTimeISO("UTC")
    .toPlainDateTime();

  await Promise.all([
    runAllQueries({
      modelId: "gpt-5-chat-latest",
      newerThan,
      platform: "chatgpt",
      queries,
      queryFn: openaiClient,
      repetitions,
      site,
    }),

    runAllQueries({
      modelId: "sonar",
      newerThan,
      platform: "perplexity",
      queries,
      queryFn: queryPerplexity,
      repetitions,
      site,
    }),

    runPlatform({
      modelId: "claude-haiku-4-5-20251001",
      newerThan,
      platform: "claude",
      queries,
      queryFn: queryClaude,
      repetitions,
      site,
    }),

    runPlatform({
      modelId: "gemini-2.5-flash",
      newerThan,
      platform: "gemini",
      queries,
      queryFn: queryGemini,
      repetitions,
      site,
    }),
  ]);

  const all = await prisma.citationQueryRun.findMany({
    where: { siteId: site.id },
    include: { queries: true },
    orderBy: { createdAt: "asc" },
  });
  const byDate = Object.entries(
    groupBy(all, ({ createdAt }) => createdAt.toISOString().slice(0, 10)),
  );
  return orderBy(byDate, [([date]) => date], ["asc"]);
}
