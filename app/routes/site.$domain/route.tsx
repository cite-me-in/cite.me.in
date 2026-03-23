import { redirect } from "react-router";
import { requireUserAccess } from "~/lib/auth.server";
import type { Route } from "./+types/route";

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireUserAccess(request);
  return redirect(`/site/${params.domain}/citations`);
}
