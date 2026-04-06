import type { Route } from "./+types/cron.process-sites";
import { loadWeeklyDigestMetrics } from "~/lib/weeklyDigest.server";
import { sendSiteDigestEmails } from "~/emails/WeeklyDigest";
import { Temporal } from "@js-temporal/polyfill";
import { data } from "react-router";
import { map } from "radashi";
import sendTrialEndingEmails from "~/emails/TrialEnding";
import sendTrialEndedEmails from "~/emails/TrialEnded";
import captureAndLogError from "~/lib/captureAndLogError.server";
import prepareSites from "~/lib/prepareSites.server";
import envVars from "~/lib/envVars.server";

// This function can run for a maximum of 300 seconds (5 minutes)
export const config = {
  maxDuration: 300,
};

export async function loader({ request }: Route.LoaderArgs) {
  if (request.headers.get("authorization") !== `Bearer ${envVars.CRON_SECRET}`)
    throw new Response("Unauthorized", { status: 401 });

  try {
    const sites = await prepareSites();
    const oneWeekAgo = new Date(
      Temporal.Now.instant().subtract({ hours: 24 * 7 }).epochMilliseconds,
    );
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
