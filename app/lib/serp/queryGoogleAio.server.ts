import { Temporal } from "@js-temporal/polyfill";
import debug from "debug";
import captureAndLogError from "~/lib/captureAndLogError.server";
import envVars from "~/lib/envVars.server";
import prisma from "~/lib/prisma.server";
import fetchAioResults from "./dataForSeo.server";

const logger = debug("server");

export default async function queryGoogleAio(site: {
  id: string;
  domain: string;
}): Promise<void> {
  if (!envVars.DATAFORSEO_LOGIN || !envVars.DATAFORSEO_PASSWORD) {
    logger("[%s:google-aio] Skipping — DATAFORSEO credentials not set", site.id);
    return;
  }

  try {
    const onDate = Temporal.Now.plainDateISO().toString();
    const run = await prisma.serpRun.upsert({
      where: { siteId_source_onDate: { siteId: site.id, source: "google-aio", onDate } },
      update: {},
      create: { siteId: site.id, source: "google-aio", onDate },
    });

    const siteQueries = await prisma.siteQuery.findMany({
      where: { siteId: site.id },
      orderBy: [{ group: "asc" }, { query: "asc" }],
    });

    for (const siteQuery of siteQueries) {
      const existing = await prisma.serpQuery.findFirst({
        where: { runId: run.id, query: siteQuery.query },
      });
      if (existing) {
        logger("[%s:google-aio] %s — already exists", site.id, siteQuery.query);
        continue;
      }

      try {
        const { aioPresent, citations } = await fetchAioResults(siteQuery.query);
        await prisma.serpQuery.create({
          data: {
            runId: run.id,
            query: siteQuery.query,
            group: siteQuery.group,
            aioPresent,
            citations,
          },
        });
        logger("[%s:google-aio] %s — aioPresent=%s citations=%d", site.id, siteQuery.query, aioPresent, citations.length);
      } catch (error) {
        captureAndLogError(error, { extra: { siteId: site.id, query: siteQuery.query } });
      }
    }
  } catch (error) {
    captureAndLogError(error, { extra: { siteId: site.id, step: "google-aio" } });
  }
}
