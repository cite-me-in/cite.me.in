import { parallel } from "radashi";
import { data } from "react-router";
import captureAndLogError from "~/lib/captureAndLogError.server";
import envVars from "~/lib/envVars.server";
import prisma from "~/lib/prisma.server";
import { attemptDelivery } from "~/lib/webhooks.server";
import type { Route } from "./+types/cron.webhook-retries";

export async function loader({ request }: Route.LoaderArgs) {
  if (request.headers.get("authorization") !== `Bearer ${envVars.CRON_SECRET}`)
    throw new Response("Unauthorized", { status: 401 });

  try {
    const pending = await prisma.webhookDelivery.findMany({
      where: { status: "RETRY", nextRetryAt: { lte: new Date() } },
      include: { endpoint: true },
    });
    await parallel({ limit: 10 }, pending, attemptDelivery);

    if (envVars.HEARTBEAT_CRON_WEBHOOK_RETRIES)
      await fetch(envVars.HEARTBEAT_CRON_WEBHOOK_RETRIES);

    return data({ ok: true, processed: pending.length });
  } catch (error) {
    captureAndLogError(error, { extra: { step: "webhook-retries" } });
    return data({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
