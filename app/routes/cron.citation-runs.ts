import debug from "debug";
import { data } from "react-router";
import envVars from "~/lib/envVars";
import queryAccount from "~/lib/llm-visibility/queryAccount";
import logError from "~/lib/logError.server";
import prisma from "~/lib/prisma.server";
import { UsageLimitExceededError } from "~/lib/usage/UsageLimitExceededError";
import type { Route } from "./+types/cron.citation-runs";

const logger = debug("server");

// Vercel Cron fires a GET with Authorization: Bearer <CRON_SECRET>.
export async function loader({ request }: Route.LoaderArgs) {
  if (request.headers.get("authorization") !== `Bearer ${envVars.CRON_SECRET}`)
    throw new Response("Unauthorized", { status: 401 });

  const sites = await prisma.site.findMany();
  logger(
    "[cron:citation-runs] Updating sites: %s",
    sites.map(({ domain }) => domain).join(", "),
  );

  const results: { siteId: string; ok: boolean; error?: string }[] = [];

  for (const site of sites) {
    try {
      const siteQueryRows = await prisma.siteQuery.findMany({
        where: { siteId: site.id },
        orderBy: [{ group: "asc" }, { query: "asc" }],
      });
      const queries = siteQueryRows
        .filter((q) => q.query.trim())
        .map((q) => ({ query: q.query, group: q.group }));
      await queryAccount({ site, queries });
      logger("[cron:citation-runs] Done — %s (%s)", site.id, site.domain);
      results.push({ siteId: site.id, ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger(
        "[cron:citation-runs] Failed — %s (%s): %s",
        site.id,
        site.domain,
        message,
      );
      if (!(error instanceof UsageLimitExceededError))
        logError(error, { extra: { siteId: site.id } });
      results.push({ siteId: site.id, ok: false, error: message });
    }
  }

  if (envVars.HEARTBEAT_CRON_CITATIONS)
    await fetch(envVars.HEARTBEAT_CRON_CITATIONS);
  return data({ ok: true, results });
}
