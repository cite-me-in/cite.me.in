import { data } from "react-router";
import captureAndLogError from "~/lib/captureAndLogError.server";
import envVars from "~/lib/envVars.server";
import checkCitingPages from "~/lib/llm-visibility/checkCitingPages";
import type { Route } from "./+types/cron.check-citing-pages";

export const config = { maxDuration: 300 }; // 5 minutes in seconds

export async function loader({ request }: Route.LoaderArgs) {
  if (request.headers.get("authorization") !== `Bearer ${envVars.CRON_SECRET}`)
    throw new Response("Unauthorized", { status: 401 });

  try {
    const results = await checkCitingPages({ staleDays: 7, limit: 500 });
    return data({ ok: true, checked: results.length, results });
  } catch (error) {
    captureAndLogError(error);
    return data({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
