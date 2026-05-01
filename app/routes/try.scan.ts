import { getScanStatus } from "~/lib/tryScan.server";
import type { Route } from "./+types/try.scan";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const domain = url.searchParams.get("domain");
  if (!domain) return { status: "idle" as const };

  const status = await getScanStatus(domain);
  if (!status) return { status: "idle" as const };

  return status;
}
