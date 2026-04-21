import debug from "debug";
import addSite from "~/lib/addSite.server";
import { requireSiteAccess } from "~/lib/auth.server";
import { appendLog, getStatus } from "~/lib/setupProgress.server";
import type { Route } from "./+types/site.$domain_.setup.run";

const logger = debug("server:setup.run");

export const config = { maxDuration: 300 }; // 5 minutes in seconds

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "POST")
    throw new Response("Method not allowed", { status: 405 });

  const { site, user } = await requireSiteAccess({
    domain: params.domain,
    request,
  });

  // Idempotency: don't start a second pipeline if one is running or done.
  const current = await getStatus({ siteId: site.id, userId: user.id });
  if (current === "running" || current === "complete")
    return new Response(null, { status: 204 });

  logger("Starting setup pipeline for site %s", site.domain);
  const log = async (line: string) => {
    logger("%s: %s", site.domain, line);
    await appendLog({ siteId: site.id, userId: user.id, line });
  };
  await addSite({ site, user, log });

  return new Response(null, { status: 204 });
}
