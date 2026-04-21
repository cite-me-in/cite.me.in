import sendAiLegibilityReport from "~/emails/AiLegibilityReport";
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

  const progress = await runAILegibilityScan({ site, user });

  if (progress.done && progress.result) {
    await sendAiLegibilityReport({
      site,
      sendTo: user,
      result: progress.result,
    });
  }

  return new Response(null, { status: 204 });
}
