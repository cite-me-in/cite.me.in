import { shuffle } from "radashi";
import {
  getProgress,
  setResult,
  setStatus,
  startNewScan,
} from "~/lib/aiLegibility/progress.server";
import captureAndLogError from "~/lib/captureAndLogError.server";
import { normalizeURL } from "~/lib/isSameDomain";
import prisma from "~/lib/prisma.server";
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
 * @param log - A function to log progress.
 * @param site - The site to scan.
 * @param user - The user who is scanning the site.
 * @returns The progress of the scan.
 */
export default async function runAILegibilityScan({
  log,
  user,
  site,
}: {
  log: (line: string) => Promise<void> | void;
  site: { id: string; domain: string };
  user: { email: string; id: string; unsubscribed: boolean };
}): Promise<ScanProgress> {
  const progress = await getProgress({ offset: 0, domain: site.domain });
  if (progress && !progress.done) return progress;

  try {
    await startNewScan({ domain: site.domain });
    await log("Starting AI legibility scan...");
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
  log: (line: string) => Promise<void> | void;
  domain: string;
}): Promise<ScanResult> {
  const url = normalizeURL(domain);
  const checks: CheckResult[] = [];

  await log("Checking homepage content...");
  const homepageResult = await checkHomepageContent({ url });
  checks.push(homepageResult);
  await log(`${homepageResult.passed ? "✓" : "✗"} ${homepageResult.message}`);

  await log("Checking sitemap.xml...");
  const sitemmapXmlResult = await checkSitemapXml({ url });
  checks.push(sitemmapXmlResult);
  await log(
    `${sitemmapXmlResult.passed ? "✓" : "✗"} ${sitemmapXmlResult.message}`,
  );

  await log("Checking sitemap.txt...");
  const sitemapTxtResult = await checkSitemapTxt({ url });
  await log(
    `${sitemapTxtResult.passed ? "✓" : "✗"} ${sitemapTxtResult.message}`,
  );
  checks.push(sitemapTxtResult);

  await log("Checking robots.txt...");
  const robotsTxtResult = await checkRobotsTxt({ url });
  await log(`${robotsTxtResult.passed ? "✓" : "✗"} ${robotsTxtResult.message}`);
  checks.push(robotsTxtResult);

  await log("Checking JSON-LD...");
  const jsonLdResult = await checkJsonLd({ html: homepageResult.html, url });
  checks.push(jsonLdResult);
  await log(`${jsonLdResult.passed ? "✓" : "✗"} ${jsonLdResult.message}`);

  await log("Checking meta tags...");
  const metaTagsResult = await checkMetaTags({
    html: homepageResult.html,
    url,
  });
  checks.push(metaTagsResult);
  await log(`${metaTagsResult.passed ? "✓" : "✗"} ${metaTagsResult.message}`);

  await log("Checking llms.txt...");
  const llmsTxtResult = await checkLlmsTxt({ url });
  checks.push(llmsTxtResult);
  await log(`${llmsTxtResult.passed ? "✓" : "✗"} ${llmsTxtResult.message}`);

  await log("Checking sample pages...");
  const sampleURLs = shuffle([
    ...new Set([...sitemmapXmlResult.urls, ...sitemapTxtResult.urls]).values(),
  ]).slice(0, 10);
  const samplePagesResult = await checkSamplePages({ url, sampleURLs });
  checks.push(samplePagesResult);
  await log(
    `${samplePagesResult.passed ? "✓" : "✗"} ${samplePagesResult.message}`,
  );

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
  log: (line: string) => Promise<void> | void;
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
