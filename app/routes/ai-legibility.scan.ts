import { data } from "react-router";
import { appendLog, setStatus } from "~/lib/aiLegibility/progress.server";
import runScanInBackground from "~/lib/aiLegibility/runScanInBackground";
import { requireUserAccess } from "~/lib/auth.server";
import { normalizeURL } from "~/lib/isSameDomain";
import { checkRateLimit } from "~/lib/rateLimit.server";
import type { Route } from "./+types/ai-legibility.scan";

const SCAN_RATE_LIMIT = { maxRequests: 5, windowSeconds: 3600 };

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST")
    throw new Response("Method not allowed", { status: 405 });

  const formData = await request.formData();
  const urlInput = formData.get("url")?.toString();
  if (!urlInput) return data({ error: "URL is required" }, { status: 400 });
  const url = normalizeURL(urlInput);

  const clientIp = getClientIp(request);
  const rateLimit = await checkRateLimit({
    identity: `ai-legibility:${clientIp}`,
    ...SCAN_RATE_LIMIT,
  });

  if (!rateLimit.allowed)
    return data(
      { error: "Rate limit exceeded. Please try again later." },
      { status: 429 },
    );

  const user = await getOptionalUser(request);
  const scanId = crypto.randomUUID();

  await setStatus({ scanId, status: "running" });
  await appendLog({ line: `Starting scan for ${url}...`, scanId });

  // Fire off the scan in the background - don't await
  runScanInBackground({ scanId, url, user });

  return data({ scanId, url });
}

async function getOptionalUser(
  request: Request,
): Promise<{ id: string; email: string; unsubscribed: boolean } | null> {
  try {
    const { user } = await requireUserAccess(request);
    return user;
  } catch {
    return null;
  }
}

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0].trim() ?? "unknown";
}
