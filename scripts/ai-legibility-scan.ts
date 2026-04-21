import sendAiLegibilityReport from "../app/emails/AiLegibilityReport";
import { setStatus } from "../app/lib/aiLegibility/progress.server";
import runAILegibilityScan from "../app/lib/aiLegibility/runAILegibilityScan";
import { normalizeDomain } from "../app/lib/isSameDomain";
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

  const site = await prisma.site.findFirst({
    where: { domain: normalizeDomain(url) },
  });
  if (!site) {
    console.error(`Site ${normalizeDomain(url)} not found`);
    process.exit(1);
  }
  const user = await prisma.user.findUniqueOrThrow({
    where: { email: "assaf@labnotes.org" },
  });

  await setStatus({ domain: site.domain, status: "running" });

  const { result } = await runAILegibilityScan({ site, user });

  const suggestions = result?.suggestions;
  if (suggestions && suggestions.length > 0) {
    console.info("\n--- SUGGESTIONS ---\n");
    for (const s of suggestions) {
      console.info(`[${s.category}] ${s.title} (${s.effort})`);
      console.info(`  ${s.description}`);
      console.info("");
    }
  }
  await sendAiLegibilityReport({ site, result, sendTo: user });

  console.info("\n--- FULL JSON ---\n");
  console.info(JSON.stringify(result, null, 2));
}

await main();
process.exit(0);
