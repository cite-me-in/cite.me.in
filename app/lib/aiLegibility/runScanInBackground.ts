import sendAiLegibilityReport from "~/emails/AiLegibilityReport";
import {
  appendLog,
  setResult,
  setStatus,
} from "~/lib/aiLegibility/progress.server";
import { runScan } from "~/lib/aiLegibility/runScan";
import captureAndLogError from "~/lib/captureAndLogError.server";
import prisma from "~/lib/prisma.server";

/**
 * Run a site scan in the background, identifying any SEO problems and
 * generating suggestions for improvement.
 *
 * @param scanId - The ID of the scan.
 * @param url - The URL to scan.
 * @param userId - The ID of the user who is scanning the URL.
 * @returns A promise that resolves when the scan is complete.
 */
export default async function runScanInBackground({
  scanId,
  url,
  user,
}: {
  scanId: string;
  url: string;
  user: { email: string; id: string; unsubscribed: boolean } | null;
}) {
  const log = async (line: string) => {
    await appendLog({ line, scanId });
  };

  try {
    const result = await runScan({ log, url });

    await setResult({ result, scanId });
    await setStatus({ scanId, status: "complete" });
    await log("Scan complete!");

    if (user) {
      await prisma.aiLegibilityReport.create({
        data: {
          id: scanId,
          user: { connect: { id: user.id } },
          url,
          result: JSON.stringify(result),
        },
      });

      await sendAiLegibilityReport({
        domain: new URL(url).hostname,
        scanId: scanId,
        sendTo: user,
        result,
      });
    }
  } catch (error) {
    captureAndLogError(error, { extra: { scanId, url } });
    await setStatus({ scanId, status: "error" });
    await log(
      `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
