import { data } from "react-router";
import { getProgress } from "~/lib/aiLegibility/progress.server";
import type { Route } from "./+types/ai-legibility.status";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const scanId = url.searchParams.get("scanId");
  const offset = Number(url.searchParams.get("offset") ?? "0");

  if (!scanId) throw new Response("scanId is required", { status: 400 });

  const progress = await getProgress({ offset, scanId });
  return data(progress);
}
