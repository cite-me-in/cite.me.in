import debug from "debug";
import captureException from "~/lib/captureException.server";
import sendDailyReportEmail from "~/lib/emails/DailyReportEmail";
import envVars from "~/lib/envVars";
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
    const id = await sendDailyReportEmail();
    return Response.json({ ok: true, id });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger("[cron:daily-report] Failed: %s", message);
    captureException(error);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
