import sendAiLegibilityReport from "~/emails/AiLegibilityReport";
import { appendLog } from "~/lib/aiLegibility/progress.server";
import runAILegibilityScan from "~/lib/aiLegibility/runAILegibilityScan";
import { requireSiteAccess } from "~/lib/auth.server";
import prisma from "~/lib/prisma.server";
import type { Route } from "./+types/site.$domain_.ai-legibility.scan";

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "POST")
    throw new Response("Method not allowed", { status: 405 });

  const { site, user } = await requireSiteAccess({
    domain: params.domain,
    request,
  });

  const log = async (line: string) => {
    await appendLog({ line, domain: site.domain });
  };
  const progress = await runAILegibilityScan({ log, site, user });

  if (progress.done && progress.result) {
    const withCitations = await prisma.site.findUniqueOrThrow({
      where: { id: site.id },
      include: { citations: true },
    });

    await sendAiLegibilityReport({
      site: withCitations,
      sendTo: user,
      result: progress.result,
    });
  }

  return new Response(null, { status: 204 });
}
