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
import { getCheckCategory, getCheckDetail } from "./checkDetails";
import checkContentSignals from "./checks/contentSignals";
import checkHomepageContent from "./checks/homepageContent";
import checkJsonLd from "./checks/jsonLd";
import checkLinkHeaders from "./checks/linkHeaders";
import checkLlmsTxt from "./checks/llmsTxt";
import checkMarkdownAlternateLinks from "./checks/markdownAlternateLinks";
import checkMarkdownNegotiation from "./checks/markdownNegotiation";
import checkMdRoutes from "./checks/mdRoutes";
import checkMetaTags from "./checks/metaTags";
import checkRobotsTxt from "./checks/robotsTxt";
import checkSamplePages from "./checks/samplePages";
import checkSitemapTxt from "./checks/sitemapTxt";
import checkSitemapXml from "./checks/sitemapXml";
import type {
  CheckResult,
  ScanProgress,
  ScanResult,
  Suggestion,
} from "./types";

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

export async function runScanSteps({
  log,
  domain,
}: {
  log: (line: string) => Promise<void> | void;
  domain: string;
}): Promise<ScanResult> {
  const scannedAt = new Date().toISOString();
  const url = normalizeURL(domain);
  const checks: Omit<CheckResult, "category">[] = [];

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

  await log("Checking Link headers (sitemap)...");
  const linkHeadersResult = await checkLinkHeaders({
    url,
    html: homepageResult.html,
  });
  checks.push(linkHeadersResult);
  await log(
    `${linkHeadersResult.passed ? "✓" : "✗"} ${linkHeadersResult.message}`,
  );

  await log("Checking markdown alternate links...");
  const markdownAlternateResult = await checkMarkdownAlternateLinks({
    url,
    html: homepageResult.html,
  });
  checks.push(markdownAlternateResult);
  await log(
    `${markdownAlternateResult.passed ? "✓" : "✗"} ${markdownAlternateResult.message}`,
  );

  await log("Checking .md routes...");
  const mdRoutesResult = await checkMdRoutes({ url });
  checks.push(mdRoutesResult);
  await log(`${mdRoutesResult.passed ? "✓" : "✗"} ${mdRoutesResult.message}`);

  await log("Checking markdown content negotiation...");
  const markdownResult = await checkMarkdownNegotiation({ url });
  checks.push(markdownResult);
  await log(`${markdownResult.passed ? "✓" : "✗"} ${markdownResult.message}`);

  await log("Checking Content-Signal in robots.txt...");
  const contentSignalsResult = await checkContentSignals({ url });
  checks.push(contentSignalsResult);
  await log(
    `${contentSignalsResult.passed ? "✓" : "✗"} ${contentSignalsResult.message}`,
  );

  const withCategory = checks.map((check) => ({
    ...check,
    category: getCheckCategory(check.name) as
      | "discovered"
      | "trusted"
      | "welcomed",
    detail: getCheckDetail(check.name),
  }));
  const summary = await summarize({ checks: withCategory, log });
  const suggestions = generateSuggestions();

  return {
    url,
    scannedAt,
    checks: withCategory,
    suggestions,
    summary,
  };
}

function generateSuggestions(): Suggestion[] {
  const suggestions: Suggestion[] = [];

  suggestions.push({
    title: "Hidden LLM hint",
    description:
      "Add a visually-hidden <div> to your pages that tells AI agents where to find clean Markdown versions. When someone pastes your URL into ChatGPT or Claude, the AI reads the rendered text and can follow the hint to get better content.",
    effort: "2 min",
    resourceLinks: [
      {
        label: "Evil Martians guide",
        url: "https://evilmartians.com/chronicles/how-to-make-your-website-visible-to-llms",
      },
    ],
  });

  suggestions.push({
    title: "/llms-full.txt",
    description:
      "Create /llms-full.txt containing your site's full content in a single Markdown file. AI tools like ChatGPT can ingest everything in one fetch. Mintlify's data shows llms-full.txt gets 3-4x more visits than llms.txt. For small sites, concatenate all page content. For larger sites, redirect to /index.md.",
    effort: "15 min",
    resourceLinks: [
      {
        label: "llms.txt spec",
        url: "https://llmstxt.org/",
      },
    ],
  });

  return suggestions;
}

async function summarize({
  checks,
  log,
}: {
  checks: CheckResult[];
  log: (line: string) => Promise<void> | void;
}): Promise<{
  discovered: { passed: number; total: number };
  trusted: { passed: number; total: number };
  welcomed: { passed: number; total: number };
}> {
  const discoveredChecks = checks.filter((c) => c.category === "discovered");
  const trustedChecks = checks.filter((c) => c.category === "trusted");
  const welcomedChecks = checks.filter((c) => c.category === "welcomed");

  const summary = {
    discovered: {
      passed: discoveredChecks.filter((c) => c.passed).length,
      total: discoveredChecks.length,
    },
    trusted: {
      passed: trustedChecks.filter((c) => c.passed).length,
      total: trustedChecks.length,
    },
    welcomed: {
      passed: welcomedChecks.filter((c) => c.passed).length,
      total: welcomedChecks.length,
    },
  };

  await log(
    `Discovered: ${summary.discovered.passed}/${summary.discovered.total} passed`,
  );
  await log(
    `Trusted: ${summary.trusted.passed}/${summary.trusted.total} passed`,
  );
  await log(
    `Welcomed: ${summary.welcomed.passed}/${summary.welcomed.total} passed`,
  );

  return summary;
}
