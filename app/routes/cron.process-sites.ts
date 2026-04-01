import { map } from "radashi";
import { data } from "react-router";
import sendTrialEndedEmails from "~/emails/TrialEnded";
import sendTrialEndingEmails from "~/emails/TrialEnding";
import { sendSiteDigestEmails } from "~/emails/WeeklyDigest";
import captureAndLogError from "~/lib/captureAndLogError.server";
import envVars from "~/lib/envVars.server";
import prepareSites from "~/lib/prepareSites.server";
import { loadWeeklyDigestMetrics } from "~/lib/weeklyDigest.server";
import type { Route } from "./+types/cron.process-sites";

// This function can run for a maximum of 300 seconds (5 minutes)
export const config = {
  maxDuration: 300,
};

export async function loader({ request }: Route.LoaderArgs) {
  if (request.headers.get("authorization") !== `Bearer ${envVars.CRON_SECRET}`)
    throw new Response("Unauthorized", { status: 401 });

  try {
    const sites = await prepareSites();
    const results = await map(sites, async (site) => {
      const data = await loadWeeklyDigestMetrics(site.id);
      const sendEmails = await sendSiteDigestEmails(data);
      return {
        emailIds: sendEmails.map((e) => e.id),
        domain: site.domain,
      };
    });

    // Send trial-ending and trial-ended emails after all sites have been processed.
    const trialDays = 25;
    await Promise.all([
      sendTrialEndingEmails(trialDays),
      sendTrialEndedEmails(trialDays),
    ]);

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
