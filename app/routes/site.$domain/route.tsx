import { redirect } from "react-router";
import { requireUser } from "~/lib/auth.server";
import type { Route } from "./+types/route";

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireUser(request);
  return redirect(`/site/${params.id}/citations`);
}
