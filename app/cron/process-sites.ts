import { convert } from "convert";
import debug from "debug";
import { map } from "radashi";
import sendTrialEndedEmails from "~/emails/TrialEnded";
import sendTrialEndingEmails from "~/emails/TrialEnding";
import { sendSiteDigestEmails } from "~/emails/WeeklyDigest";
import { runJob } from "~/lib/cron/runJob";
import { daysAgo } from "~/lib/formatDate";
import prepareSites from "~/lib/prepareSites.server";
import { loadWeeklyDigestMetrics } from "~/lib/weeklyDigest.server";

export const schedule = "0 9 * * 1";
export const timeout = convert(10, "minutes").to("seconds");
export const skip = true;

const logger = debug("server");

async function main() {
  console.info("Processing sites...");
  const sites = await prepareSites({ maxSites: 5, log: logger });

  const oneWeekAgo = daysAgo(7);
  const results = await map(sites, async (site) => {
    if (site.digestSentAt && site.digestSentAt > oneWeekAgo) {
      return { domain: site.domain, skipped: true };
    }
    const sendEmails = await sendSiteDigestEmails(await loadWeeklyDigestMetrics(site.id));
    return {
      emailIds: sendEmails.map((e) => e.id),
      domain: site.domain,
      skipped: false,
    };
  });

  await sendTrialEndedEmails();
  await sendTrialEndingEmails();

  const emailCount = results.flatMap((r) => r.emailIds ?? []).length;
  console.info(`Done: processed ${sites.length} sites, sent ${emailCount} digest emails`);
  return { sites: results };
}

if (import.meta.main) await runJob("process-sites", main);

export default main;
