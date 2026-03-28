import { requireSiteAccess } from "~/lib/auth.server";
import { getProgress } from "~/lib/setupProgress.server";
import type { Route } from "./+types/site.$domain_.setup.status";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { site, user } = await requireSiteAccess({
    domain: params.domain,
    request,
  });

  const offset = Number(new URL(request.url).searchParams.get("offset") ?? "0");
  const progress = await getProgress({
    siteId: site.id,
    userId: user.id,
    offset,
  });
  return Response.json(progress);
}
