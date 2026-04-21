import { shuffle } from "radashi";
import sendAiLegibilityReport from "~/emails/AiLegibilityReport";
import {
  appendLog,
  getProgress,
  setResult,
  setStatus,
  startNewScan,
} from "~/lib/aiLegibility/progress.server";
import captureAndLogError from "~/lib/captureAndLogError.server";
import prisma from "~/lib/prisma.server";
import { normalizeURL } from "../isSameDomain";
import checkHomepageContent from "./checks/homepageContent";
import checkJsonLd from "./checks/jsonLd";
import checkLlmsTxt from "./checks/llmsTxt";
import checkMetaTags from "./checks/metaTags";
import checkRobotsTxt from "./checks/robotsTxt";
import checkSamplePages from "./checks/samplePages";
import checkSitemapTxt from "./checks/sitemapTxt";
import checkSitemapXml from "./checks/sitemapXml";
import generateSuggestions from "./generateSuggestions";
import type { CheckResult, ScanProgress, ScanResult } from "./types";

/**
 * Run AI Legibility scan for a site, identifying any SEO problems and
 * generating suggestions for improvement. Immediately updates progress in
 * Redis, everything else runs in a separate tick. Only one scan per site can
 * run at a time, so if a scan is already in progress, the function will return
 * the progress.
 *
 * @param site - The site to scan.
 * @param user - The user who is scanning the site.
 * @returns The progress of the scan.
 */
export default async function runAILegibilityScan({
  user,
  site,
}: {
  site: { id: string; domain: string };
  user: { email: string; id: string; unsubscribed: boolean };
}): Promise<ScanProgress> {
  const log = async (line: string) => {
    await appendLog({ line, domain: site.domain });
  };

  const progress = await getProgress({ offset: 0, domain: site.domain });
  if (!progress.done) return progress;

  try {
    await startNewScan({ domain: site.domain });
    await log(`Scanning ${site.domain}...`);
    const result = await runScanSteps({ log, domain: site.domain });

    await setResult({ result, domain: site.domain });
    await setStatus({ domain: site.domain, status: "complete" });
    await log("Scan complete!");

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
    return { lines: [], done: true, nextOffset: 0, result };
  } catch (error) {
    captureAndLogError(error, { extra: { site } });
    await setStatus({ domain: site.domain, status: "error" });
    await log(
      `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
    return { lines: [], done: false, nextOffset: 0, result: undefined };
  }
}

async function runScanSteps({
  log,
  domain,
}: {
  log: (line: string) => Promise<void>;
  domain: string;
}): Promise<ScanResult> {
  const url = normalizeURL(domain);
  const checks: CheckResult[] = [];

  const homepageResult = await checkHomepageContent({ log, url });
  checks.push(homepageResult);

  const sitemmapXmlResult = await checkSitemapXml({ log, url });
  checks.push(sitemmapXmlResult);
  const sitemapTxtResult = await checkSitemapTxt({ log, url });
  checks.push(sitemapTxtResult);

  checks.push(await checkRobotsTxt({ log, url }));
  checks.push(await checkJsonLd({ log, html: homepageResult.html, url }));
  checks.push(await checkMetaTags({ log, html: homepageResult.html, url }));
  checks.push(await checkLlmsTxt({ log, url }));

  const sampleURLs = shuffle([
    ...new Set([...sitemmapXmlResult.urls, ...sitemapTxtResult.urls]).values(),
  ]).slice(0, 10);
  checks.push(await checkSamplePages({ log, url, sampleURLs }));

  const summary = await summarize({ checks, log });
  const suggestions = await generateSuggestions({ log, checks, url });

  return {
    url,
    scannedAt: new Date().toISOString(),
    checks,
    summary,
    suggestions,
  };
}

async function summarize({
  checks,
  log,
}: {
  checks: CheckResult[];
  log: (line: string) => Promise<void>;
}): Promise<{
  critical: { passed: number; total: number };
  important: { passed: number; total: number };
  optimization: { passed: number; total: number };
}> {
  const criticalChecks = checks.filter((c) => c.category === "critical");
  const importantChecks = checks.filter((c) => c.category === "important");
  const optimizationChecks = checks.filter(
    (c) => c.category === "optimization",
  );

  const summary = {
    critical: {
      passed: criticalChecks.filter((c) => c.passed).length,
      total: criticalChecks.length,
    },
    important: {
      passed: importantChecks.filter((c) => c.passed).length,
      total: importantChecks.length,
    },
    optimization: {
      passed: optimizationChecks.filter((c) => c.passed).length,
      total: optimizationChecks.length,
    },
  };

  await log(
    `Critical: ${summary.critical.passed}/${summary.critical.total} passed`,
  );
  await log(
    `Important: ${summary.important.passed}/${summary.important.total} passed`,
  );
  await log(
    `Optimization: ${summary.optimization.passed}/${summary.optimization.total} passed`,
  );

  return summary;
}
