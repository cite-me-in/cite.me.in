import { data } from "react-router";
import { getScanStatus } from "~/lib/tryScan.server";
import type { Route } from "./+types/try.scan";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const domain = url.searchParams.get("domain");
  if (!domain) return data({ status: "idle" as const });

  const status = await getScanStatus(domain);
  return status ? data(status) : data({ status: "idle" as const });
}
