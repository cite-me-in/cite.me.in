import { redirect } from "react-router";
import runAILegibilityScan from "~/lib/aiLegibility/runAILegibilityScan";
import { requireSiteAccess } from "~/lib/auth.server";
import type { Route } from "./+types/site.$domain_.ai-legibility.scan";

export const config = { maxDuration: 300 }; // 5 minutes in seconds

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "POST")
    throw new Response("Method not allowed", { status: 405 });

  const { site, user } = await requireSiteAccess({
    domain: params.domain,
    request,
  });
  await runAILegibilityScan({
    site,
    user: { id: user.id, email: user.email, unsubscribed: user.unsubscribed },
  });
  return redirect(`/site/${site.domain}/ai-legibility`);
}
