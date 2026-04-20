import sendAiLegibilityReport from "~/emails/AiLegibilityReport";
import {
  appendLog,
  getProgress,
  setResult,
  setStatus,
  startNewScan,
} from "~/lib/aiLegibility/progress.server";
import { runScan } from "~/lib/aiLegibility/runScan";
import captureAndLogError from "~/lib/captureAndLogError.server";
import prisma from "~/lib/prisma.server";
import type { ScanProgress } from "./types";

/**
 * Run a site scan in the background, identifying any SEO problems and
 * generating suggestions for improvement. Immediately updates progress in
 * Redis, everything else runs in a separate tick.
 *
 * @param scanId - The ID of the scan.
 * @param url - The URL to scan.
 * @param userId - The ID of the user who is scanning the URL.
 * @returns The progress of the scan.
 */
export default async function runScanInBackground({
  user,
  site,
}: {
  site: { id: string; domain: string };
  user: { email: string; id: string; unsubscribed: boolean } | null;
}): Promise<ScanProgress> {
  const log = async (line: string) => {
    await appendLog({ line, domain: site.domain });
  };

  const progress = await getProgress({ offset: 0, domain: site.domain });
  if (!progress.done) return progress;

  await startNewScan({ domain: site.domain });
  await log(`Scanning ${site.domain}...`);

  setImmediate(async () => {
    try {
      const result = await runScan({ log, domain: site.domain });

      await setResult({ result, domain: site.domain });
      await setStatus({ domain: site.domain, status: "complete" });
      await log("Scan complete!");

      if (user) {
        await prisma.aiLegibilityReport.create({
          data: {
            site: { connect: { id: site.id } },
            user: { connect: { id: user.id } },
            result: JSON.stringify(result),
          },
        });

        await sendAiLegibilityReport({
          site,
          sendTo: user,
          result,
        });
      }

      return { result, scannedAt: new Date().toISOString() };
    } catch (error) {
      captureAndLogError(error, { extra: { site } });
      await setStatus({ domain: site.domain, status: "error" });
      await log(
        `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      return null;
    }
  });

  return await getProgress({ offset: 0, domain: site.domain });
}
