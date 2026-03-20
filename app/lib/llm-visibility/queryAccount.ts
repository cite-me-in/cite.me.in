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
  await Promise.all([
    queryPlatform({
      siteId: site.id,
      modelId: "gpt-5-chat-latest",
      platform: "chatgpt",
      queries,
      queryFn: openaiClient,
      site,
    }),

    queryPlatform({
      siteId: site.id,
      modelId: "sonar",
      platform: "perplexity",
      queries,
      queryFn: queryPerplexity,
      site,
    }),

    runPlatform({
      siteId: site.id,
      modelId: "claude-haiku-4-5-20251001",
      platform: "claude",
      queries,
      queryFn: queryClaude,
      site,
    }),

    runPlatform({
      siteId: site.id,
      modelId: "gemini-2.5-flash",
      platform: "gemini",
      queries,
      queryFn: queryGemini,
      site,
    }),
  ]);

  const all = await prisma.citationQueryRun.findMany({
    where: { siteId: site.id },
    include: { queries: true },
    orderBy: { onDate: "asc" },
  });
  const byDate = Object.entries(groupBy(all, ({ onDate }) => onDate));
  return orderBy(byDate, [([date]) => date], ["asc"]);
}
