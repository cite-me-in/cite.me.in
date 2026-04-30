import { startScan } from "~/lib/tryScan.server";
import type { Route } from "./+types/try.start";

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const domain = (form.get("domain") as string).trim().toLowerCase();
  if (!domain) return { error: "Missing domain" };

  startScan(domain);
  return { ok: true as const };
}
