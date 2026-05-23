import sendAiLegibilityReport from "~/emails/AiLegibilityReport";
import { setStatus } from "~/lib/aiLegibility/progress.server";
import runAILegibilityScan from "~/lib/aiLegibility/runAILegibilityScan";
import { normalizeDomain } from "~/lib/isSameDomain";
import prisma from "~/lib/prisma.server";

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
  console.info(`Scanning ${url}...`);
  console.info(`Scan ID: ${scanId}`);
  console.info();

  const site = await prisma.site.findFirst({
    where: { domain: normalizeDomain(url) },
    include: { citations: true },
  });
  if (!site) {
    console.error(`Site ${normalizeDomain(url)} not found`);
    process.exit(1);
  }
  const user = await prisma.user.findUniqueOrThrow({
    where: { email: "assaf@labnotes.org" },
  });

  await setStatus({ domain: site.domain, status: "running" });

  const progress = await runAILegibilityScan({
    log: console.info,
    site,
    user,
  });
  const { result } = progress;
  if (!result) {
    console.error(`Scan for ${site.domain} did not complete successfully`);
    process.exit(1);
  }

  await sendAiLegibilityReport({ site, result, sendTo: user });

  console.info("\n--- FULL JSON ---\n");
  console.info(JSON.stringify(result, null, 2));
}

await main();
process.exit(0);
