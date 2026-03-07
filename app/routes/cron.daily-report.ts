import { captureException } from "@sentry/react-router";
import debug from "debug";
import envVars from "~/lib/envVars";
import { sendDailyReportEmail } from "~/lib/email.server";
import { generateDailyReport } from "~/lib/reports.server";
import type { Route } from "./+types/cron.daily-report";

const logger = debug("server");

// Vercel Cron fires a GET with Authorization: Bearer <CRON_SECRET>.
export async function loader({ request }: Route.LoaderArgs) {
  const cronSecret = envVars.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("Authorization");
    if (auth !== `Bearer ${cronSecret}`)
      return new Response("Unauthorized", { status: 401 });
  }

  try {
    logger("[cron:daily-report] Generating report");
    const html = await generateDailyReport();

    const reportEmail = envVars.REPORT_EMAIL;
    if (!reportEmail) {
      logger("[cron:daily-report] REPORT_EMAIL not configured");
      return Response.json({
        ok: false,
        error: "REPORT_EMAIL not configured",
      });
    }

    await sendDailyReportEmail(reportEmail, html);
    logger("[cron:daily-report] Report sent to %s", reportEmail);

    return Response.json({ ok: true, sentTo: reportEmail });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger("[cron:daily-report] Failed: %s", message);
    captureException(error);
    return Response.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
