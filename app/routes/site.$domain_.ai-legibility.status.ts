import { data } from "react-router";
import { getProgress } from "~/lib/aiLegibility/progress.server";
import { requireSiteAccess } from "~/lib/auth.server";
import type { Route } from "./+types/site.$domain_.ai-legibility.status";

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireSiteAccess({ domain: params.domain, request });
  const offset = Number(new URL(request.url).searchParams.get("offset") ?? "0");
  const progress = await getProgress({ offset, domain: params.domain });
  return data(progress);
}
