import { Temporal } from "@js-temporal/polyfill";
import { groupBy, orderBy } from "es-toolkit";
import prisma from "~/lib/prisma.server";
import queryClaude from "./claudeClient";
import queryGemini from "./geminiClient";
import openaiClient from "./openaiClient";
import queryPerplexity from "./perplexityClient";
import {
  default as queryPlatform,
  default as runPlatform,
} from "./queryPlatform";

/**
 * Query all platforms for a given site and queries.
 *
 * @param site - The site to query.
 * @param queries - The queries to query.
 * @returns The results of the queries.
 */
export default async function queryAccount({
  site,
  queries,
}: {
  site: { id: string; domain: string };
  queries: { query: string; group: string }[];
}) {
  const newerThan = Temporal.Now.instant()
    .subtract({ hours: 24 })
    .toZonedDateTimeISO("UTC")
    .toPlainDateTime();

  await Promise.all([
    queryPlatform({
      siteId: site.id,
      modelId: "gpt-5-chat-latest",
      newerThan,
      platform: "chatgpt",
      queries,
      queryFn: openaiClient,
      site,
    }),

    queryPlatform({
      siteId: site.id,
      modelId: "sonar",
      newerThan,
      platform: "perplexity",
      queries,
      queryFn: queryPerplexity,
      site,
    }),

    runPlatform({
      siteId: site.id,
      modelId: "claude-haiku-4-5-20251001",
      newerThan,
      platform: "claude",
      queries,
      queryFn: queryClaude,
      site,
    }),

    runPlatform({
      siteId: site.id,
      modelId: "gemini-2.5-flash",
      newerThan,
      platform: "gemini",
      queries,
      queryFn: queryGemini,
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
