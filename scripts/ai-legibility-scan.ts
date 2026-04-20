import sendAiLegibilityReport from "../app/emails/AiLegibilityReport";
import {
  appendLog,
  setResult,
  setStatus,
} from "../app/lib/aiLegibility/progress.server";
import { runScan } from "../app/lib/aiLegibility/runScan";
import prisma from "../app/lib/prisma.server";

const url = process.argv[2];

if (!url) {
  console.error("Usage: tsx scripts/ai-legibility-scan.ts <url>");
  console.error(
    "Example: tsx scripts/ai-legibility-scan.ts https://example.com",
  );
  process.exit(1);
}

const scanId = crypto.randomUUID();

async function main() {
  console.log(`Scanning ${url}...`);
  console.log(`Scan ID: ${scanId}`);
  console.log("");

  await setStatus({ scanId, status: "running" });

  const log = async (line: string) => {
    console.log(line);
    await appendLog({ line, scanId });
  };

  const result = await runScan({ log, url });

  await setResult({ result, scanId });
  await setStatus({ scanId, status: "complete" });

  console.info("\n--- RESULTS ---\n");
  console.info(
    `Critical: ${result.summary.critical.passed}/${result.summary.critical.total}`,
  );
  console.info(
    `Important: ${result.summary.important.passed}/${result.summary.important.total}`,
  );
  console.info(
    `Optimization: ${result.summary.optimization.passed}/${result.summary.optimization.total}`,
  );

  if (result.suggestions.length > 0) {
    console.info("\n--- SUGGESTIONS ---\n");
    for (const s of result.suggestions) {
      console.info(`[${s.category}] ${s.title} (${s.effort})`);
      console.info(`  ${s.description}`);
      console.info("");
    }
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { email: "assaf@labnotes.org" },
  });
  await sendAiLegibilityReport({
    domain: new URL(result.url).hostname,
    scanId: scanId,
    result,
    sendTo: user,
  });

  console.info("\n--- FULL JSON ---\n");
  console.info(JSON.stringify(result, null, 2));
}

await main();
process.exit(0);
