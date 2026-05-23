import debug from "debug";
import { map } from "radashi";
import { data } from "react-router";
import sendTrialEndedEmails from "~/emails/TrialEnded";
import sendTrialEndingEmails from "~/emails/TrialEnding";
import { sendSiteDigestEmails } from "~/emails/WeeklyDigest";
import captureAndLogError from "~/lib/captureAndLogError.server";
import envVars from "~/lib/envVars.server";
import { daysAgo } from "~/lib/formatDate";
import prepareSites from "~/lib/prepareSites.server";
import { loadWeeklyDigestMetrics } from "~/lib/weeklyDigest.server";
import type { Route } from "./+types/cron.process-sites";

const logger = debug("server");

export async function loader({ request }: Route.LoaderArgs) {
  if (request.headers.get("authorization") !== `Bearer ${envVars.CRON_SECRET}`)
    throw new Response("Unauthorized", { status: 401 });

  try {
    const sites = await prepareSites({ maxSites: 5, log: logger });

    const oneWeekAgo = daysAgo(7);
    const results = await map(sites, async (site) => {
      if (site.digestSentAt && site.digestSentAt > oneWeekAgo)
        return { emailIds: [], domain: site.domain, skipped: true };
      const sendEmails = await sendSiteDigestEmails(
        await loadWeeklyDigestMetrics(site.id),
      );
      return {
        emailIds: sendEmails.map((e) => e.id),
        domain: site.domain,
        skipped: false,
      };
    });

    // Send trial emails sequentially: TrialEnded first so its SentEmail record
    // exists before TrialEnding checks, preventing both sending in the same run.
    await sendTrialEndedEmails();
    await sendTrialEndingEmails();

    if (envVars.HEARTBEAT_CRON_PROCESS_SITES)
      await fetch(envVars.HEARTBEAT_CRON_PROCESS_SITES);
    return data({ ok: true, results });
  } catch (error) {
    captureAndLogError(error, { extra: { step: "process-sites" } });
    return data({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
