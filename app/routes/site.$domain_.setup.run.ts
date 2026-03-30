import { ms } from "convert";
import { sleep } from "radashi";
import sendSiteSetupEmail from "~/emails/SiteSetupComplete";
import addSiteQueries from "~/lib/addSiteQueries";
import { requireSiteAccess } from "~/lib/auth.server";
import analyzeSentiment from "~/lib/llm-visibility/analyzeSentiment";
import generateSiteQueries from "~/lib/llm-visibility/generateSiteQueries";
import PLATFORMS from "~/lib/llm-visibility/platformsToQuery.server";
import type { QueryFn } from "~/lib/llm-visibility/queryFn";
import { singleQueryRepetition } from "~/lib/llm-visibility/queryPlatform";
import logError from "~/lib/logError.server";
import prisma from "~/lib/prisma.server";
import { crawl } from "~/lib/scrape/crawl";
import { summarize } from "~/lib/scrape/summarize";
import { appendLog, getStatus, setStatus } from "~/lib/setupProgress.server";
import type { Route } from "./+types/site.$domain_.setup.run";

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "POST")
    throw new Response("Method not allowed", { status: 405 });

  const { site, user } = await requireSiteAccess({
    domain: params.domain,
    request,
  });

  // Idempotency: don't start a second pipeline if one is running or done.
  const current = await getStatus({ siteId: site.id, userId: user.id });
  if (current === "running" || current === "complete")
    return new Response(null, { status: 204 });

  await setStatus({ siteId: site.id, userId: user.id, status: "running" });

  const log = (line: string) =>
    appendLog({ siteId: site.id, userId: user.id, line });

  try {
    // Phase 1: Crawl
    await log(`Crawling ${site.domain}...`);
    const content = await crawl({
      domain: site.domain,
      maxPages: 10,
      maxWords: 5_000,
      maxSeconds: 15,
    });
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    await log(`Found ${wordCount.toLocaleString()} words of content`);
    await prisma.site.update({ where: { id: site.id }, data: { content } });

    // Phase 2: Summarize
    await log("Summarizing content...");
    const summary = await summarize({ domain: site.domain, content });
    await log(summary);
    await prisma.site.update({ where: { id: site.id }, data: { summary } });

    // Phase 3: Generate queries
    await log("Generating queries...");
    const suggestions = await generateSiteQueries(site);
    for (const { group, query } of suggestions)
      await log(`  [${group}] ${query}`);

    // Phase 4: Save queries to DB
    const queries = suggestions.filter((q) => q.query.trim());
    await addSiteQueries(site, queries);

    // Clean up suggestions now that they've been promoted.
    await prisma.siteQuerySuggestion.deleteMany({ where: { siteId: site.id } });

    // Phase 5: Query all 4 platforms in parallel
    await log("Querying AI platforms...");
    await Promise.all(
      PLATFORMS.map(({ name: platform, modelId, queryFn, label }) =>
        runPlatformWithProgress({
          site,
          platform,
          modelId,
          queryFn,
          label,
          queries,
          log,
        }),
      ),
    );

    // Phase 6: Email
    await log("Sending confirmation email...");
    const owner = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { email: true, unsubscribed: true },
    });
    await sendSiteSetupEmail({ domain: site.domain, user: owner });

    await log("Done! Your citations are ready.");
    await setStatus({ siteId: site.id, userId: user.id, status: "complete" });
  } catch (error) {
    await log("Something went wrong — please try refreshing.");
    await setStatus({ siteId: site.id, userId: user.id, status: "error" });
    logError(error, { extra: { siteId: site.id } });
  }

  return new Response(null, { status: 204 });
}

async function runPlatformWithProgress({
  site,
  platform,
  modelId,
  queryFn,
  label,
  queries,
  log,
}: {
  site: { id: string; domain: string };
  platform: string;
  modelId: string;
  queryFn: QueryFn;
  label: string;
  queries: { query: string; group: string }[];
  log: (line: string) => Promise<unknown>;
}) {
  const onDate = new Date().toISOString().split("T")[0];
  const run = await prisma.citationQueryRun.upsert({
    where: { siteId_platform_onDate: { onDate, platform, siteId: site.id } },
    update: { model: modelId },
    create: { onDate, model: modelId, platform, siteId: site.id },
  });

  for (const [index, { query, group }] of queries.entries()) {
    // Shorter stagger than the daily cron (1s) — setup is a one-time event.
    if (process.env.NODE_ENV !== "test") await sleep(ms("200ms") * index);
    await log(`${label}: ${query} (${index + 1}/${queries.length})`);
    await singleQueryRepetition({
      siteId: site.id,
      group,
      modelId,
      platform,
      query,
      queryFn,
      runId: run.id,
      site,
    });
  }

  // Sentiment analysis for this platform's run.
  try {
    const completedQueries = await prisma.citationQuery.findMany({
      where: { runId: run.id },
    });
    const { label: sentLabel, summary } = await analyzeSentiment({
      domain: site.domain,
      queries: completedQueries,
    });
    await prisma.citationQueryRun.update({
      where: { id: run.id },
      data: { sentimentLabel: sentLabel, sentimentSummary: summary },
    });
  } catch (error) {
    logError(error, { extra: { siteId: site.id, platform } });
  }
}
