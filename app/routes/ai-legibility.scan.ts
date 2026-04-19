import { data } from "react-router";
import sendAiLegibilityReport from "~/emails/AiLegibilityReport";
import {
  appendLog,
  setResult,
  setStatus,
} from "~/lib/aiLegibility/progress.server";
import { runScan } from "~/lib/aiLegibility/runScan";
import { requireUserAccess } from "~/lib/auth.server";
import captureAndLogError from "~/lib/captureAndLogError.server";
import prisma from "~/lib/prisma.server";
import { checkRateLimit } from "~/lib/rateLimit.server";
import type { Route } from "./+types/ai-legibility.scan";

const SCAN_RATE_LIMIT = { maxRequests: 5, windowSeconds: 3600 };

function normalizeUrl(input: string): string {
  let url = input.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }
  try {
    const parsed = new URL(url);
    return parsed.origin;
  } catch {
    throw new Error("Invalid URL");
  }
}

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return "unknown";
}

async function getOptionalUser(
  request: Request,
): Promise<{ id: string; email: string } | null> {
  try {
    const { user } = await requireUserAccess(request);
    return user;
  } catch {
    return null;
  }
}

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    throw new Response("Method not allowed", { status: 405 });
  }

  const formData = await request.formData();
  const urlInput = formData.get("url")?.toString();

  if (!urlInput) {
    return data({ error: "URL is required" }, { status: 400 });
  }

  let url: string;
  try {
    url = normalizeUrl(urlInput);
  } catch {
    return data({ error: "Invalid URL format" }, { status: 400 });
  }

  const clientIp = getClientIp(request);
  const rateLimit = await checkRateLimit({
    identity: `ai-legibility:${clientIp}`,
    ...SCAN_RATE_LIMIT,
  });

  if (!rateLimit.allowed) {
    return data(
      { error: "Rate limit exceeded. Please try again later." },
      { status: 429 },
    );
  }

  const user = await getOptionalUser(request);
  const scanId = crypto.randomUUID();

  await setStatus({ scanId, status: "running" });
  await appendLog({ line: `Starting scan for ${url}...`, scanId });

  // Fire off the scan in the background - don't await
  runScanInBackground({ scanId, url, userId: user?.id });

  return data({ scanId, url });
}

async function runScanInBackground({
  scanId,
  url,
  userId,
}: {
  scanId: string;
  url: string;
  userId?: string;
}) {
  const log = async (line: string) => {
    await appendLog({ line, scanId });
  };

  try {
    const result = await runScan({ log, url });

    await setResult({ result, scanId });
    await setStatus({ scanId, status: "complete" });
    await log("Scan complete!");

    if (userId) {
      try {
        // Use scanId as the report ID for consistent URLs
        await prisma.aiLegibilityReport.create({
          data: {
            id: scanId,
            userId,
            url,
            result: JSON.parse(JSON.stringify(result)),
          },
        });

        const owner = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, id: true, unsubscribed: true },
        });

        if (owner && !owner.unsubscribed) {
          await sendAiLegibilityReport({
            domain: url,
            reportId: scanId,
            sendTo: owner,
            result,
          });
        }
      } catch (error) {
        captureAndLogError(error, { extra: { userId, url } });
      }
    }
  } catch (error) {
    await setStatus({ scanId, status: "error" });
    await log(
      `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
    captureAndLogError(error, { extra: { scanId, url } });
  }
}
