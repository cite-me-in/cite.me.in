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
import checkAiBotTraffic from "./checks/aiBotTraffic";
import assessPages from "./checks/assessPages";
import checkContentSignals from "./checks/contentSignals";
import checkJsonLd from "./checks/jsonLd";
import checkLinkHeaders from "./checks/linkHeaders";
import checkLlmsFullTxt from "./checks/llmsFullTxt";
import checkLlmsTxt from "./checks/llmsTxt";
import checkMarkdownAlternateLinks from "./checks/markdownAlternateLinks";
import checkMarkdownNegotiation from "./checks/markdownNegotiation";
import checkMdRoutes from "./checks/mdRoutes";
import checkMetaTags from "./checks/metaTags";
import checkRobotsDirectives from "./checks/robotsDirectives";
import checkRobotsTxt from "./checks/robotsTxt";
import checkSitemapTxt from "./checks/sitemapTxt";
import checkSitemapXml from "./checks/sitemapXml";
import type { CheckResult, ScanProgress, ScanResult, Suggestion } from "./types";

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
    await log("Scan complete!");

    await prisma.aiLegibilityReport.create({
      data: {
        site: { connect: { id: site.id } },
        user: { connect: { id: user.id } },
        result: JSON.stringify(result),
      },
    });

    await setStatus({ domain: site.domain, status: "complete" });

    return { lines: [], done: true, nextOffset: 0, result };
  } catch (error) {
    captureAndLogError(error, { extra: { site } });
    await setStatus({ domain: site.domain, status: "error" });
    await log(`❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    return { lines: [], done: false, nextOffset: 0, result: undefined };
  }
}

type AssessedPage = {
  url: string;
  html: string;
  headers: Headers;
  ok: boolean;
  status: number;
  timedOut: boolean;
  passed: boolean;
  message: string;
  error?: string;
};

async function collectSampleUrls(
  sitemapXmlResult: { urls: string[] },
  sitemapTxtResult: { urls: string[] },
  homepageResult: { html?: string },
  url: string,
): Promise<string[]> {
  const urlsFrom = (result: { urls: string[] }) => result.urls;
  let sampleURLs = shuffle([
    ...new Set([...urlsFrom(sitemapXmlResult), ...urlsFrom(sitemapTxtResult)]).values(),
  ]).slice(0, 10);

  if (sampleURLs.length === 0 && homepageResult.html) {
    const links = homepageResult.html.matchAll(/<a[^>]+href\s*=\s*["']([^"']+)["'][^>]*>/gi);
    const resolved: string[] = [];
    for (const match of links) {
      try {
        const href = match[1];
        if (href.startsWith("/") || href.startsWith(url)) {
          resolved.push(new URL(href, url).href);
        }
      } catch {}
    }
    sampleURLs = shuffle([...new Set(resolved)]).slice(0, 10);
  }

  return sampleURLs;
}

async function fetchSamplePages(
  pagesToFetch: string[],
  log: (line: string) => Promise<void> | void,
): Promise<{ pages: AssessedPage[]; result: Omit<CheckResult, "category"> }> {
  await log(`Checking sample pages... (0/${pagesToFetch.length})`);
  const fetchedPages: AssessedPage[] = [];
  for (let i = 0; i < pagesToFetch.length; i++) {
    const results = await assessPages({ urls: [pagesToFetch[i]] });
    fetchedPages.push(results[0]);
    await log(`Checking sample pages... (${i + 1}/${pagesToFetch.length})`);
  }

  const fetchedPassed = fetchedPages.filter((p) => p.passed).length;
  const fetchedTimedOut = fetchedPages.filter((p) => p.timedOut).length;
  const result: Omit<CheckResult, "category"> = {
    name: "Sample pages",
    passed: fetchedPages.every((p) => p.passed),
    message:
      fetchedPages.length === 0
        ? "No sample URLs found in sitemap"
        : fetchedPassed === fetchedPages.length
          ? `All ${fetchedPages.length} sample pages have meaningful content`
          : `${fetchedPassed}/${fetchedPages.length} pages have meaningful content${fetchedTimedOut > 0 ? ` (${fetchedTimedOut} timed out)` : ""} (see details)`,
    details: {
      passedCount: fetchedPassed,
      totalCount: fetchedPages.length,
      timedOutCount: fetchedTimedOut,
      failedPages: fetchedPages
        .filter((p) => !p.passed)
        .map((p) => ({
          url: p.url,
          message: p.message,
          timedOut: p.timedOut,
        })),
    },
  };

  return { pages: fetchedPages, result };
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

  async function runCheck<T extends { passed: boolean; message: string }>(
    name: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    await log(`Checking ${name}...`);
    const result = await fn();
    checks.push(result);
    await log(`${result.passed ? "✓" : "✗"} ${result.message}`);
    return result;
  }

  // Homepage — special case, not wrapped in runCheck
  await log("Checking page content...");
  const [homepageResult] = await assessPages({ urls: [url] });
  checks.push({
    name: "Page content",
    passed: homepageResult.passed,
    message: homepageResult.message,
    details: { url },
  });
  await log(`${homepageResult.passed ? "✓" : "✗"} ${homepageResult.message}`);

  // Discovery checks
  const robotsTxtResult = await runCheck("robots.txt", () => checkRobotsTxt({ url }));
  const sitemapXmlResult = await runCheck("sitemap.xml", () =>
    checkSitemapXml({ url, robotsSitemapUrls: robotsTxtResult.sitemapURLs }),
  );
  const sitemapTxtResult = await runCheck("sitemap.txt", () =>
    checkSitemapTxt({ url, robotsSitemapUrls: robotsTxtResult.sitemapURLs }),
  );

  // Sample pages — special block, not wrapped in runCheck
  const sampleURLs = await collectSampleUrls(
    sitemapXmlResult,
    sitemapTxtResult,
    homepageResult,
    url,
  );
  const pagesToFetch = sampleURLs.filter((u) => u !== url);
  const { pages: fetchedPages, result: samplePagesResult } = await fetchSamplePages(
    pagesToFetch,
    log,
  );
  checks.push(samplePagesResult);
  await log(`${samplePagesResult.passed ? "✓" : "✗"} ${samplePagesResult.message}`);

  const reviewedPages = [homepageResult, ...fetchedPages];

  // Content checks
  await runCheck("JSON-LD", () =>
    checkJsonLd({ pages: reviewedPages.map((p) => ({ url: p.url, html: p.html })) }),
  );
  await runCheck("meta tags", () =>
    checkMetaTags({ pages: reviewedPages.map((p) => ({ url: p.url, html: p.html })) }),
  );
  await runCheck("llms.txt", () => checkLlmsTxt({ url }));
  await runCheck("sitemap link headers", () =>
    checkLinkHeaders({
      html: homepageResult.html,
      links: new Headers(homepageResult.headers ?? {}),
    }),
  );

  // .md checks — chained dependency, keep result from markdownAlternateLinks
  const markdownAlternateResult = await runCheck("markdown alternate links", () =>
    checkMarkdownAlternateLinks({ pages: reviewedPages }),
  );
  await runCheck(".md routes", () =>
    checkMdRoutes({
      urls:
        ((markdownAlternateResult.details ?? {}) as { alternateUrls?: string[] }).alternateUrls ??
        [],
    }),
  );

  // Trusted checks
  await runCheck("robots directives (noindex)", () =>
    checkRobotsDirectives({ pages: reviewedPages }),
  );
  await runCheck("markdown content negotiation", () =>
    checkMarkdownNegotiation({
      pages: [{ url }, ...fetchedPages.map((p) => ({ url: p.url }))],
    }),
  );
  await runCheck("Content-Signal in robots.txt", () =>
    checkContentSignals({
      robotsContent: (robotsTxtResult.details?.robotsContent as string) ?? null,
    }),
  );
  await runCheck("AI bot traffic", () =>
    checkAiBotTraffic({
      url,
      sampleUrls: fetchedPages.length > 0 ? fetchedPages.map((p) => p.url) : undefined,
      log,
    }),
  );
  await runCheck("llms-full.txt", () => checkLlmsFullTxt({ url }));

  const withCategory = checks.map((check) => ({
    ...check,
    category: getCheckCategory(check.name) as "discovered" | "trusted" | "welcomed",
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

  await log(`Discovered: ${summary.discovered.passed}/${summary.discovered.total} passed`);
  await log(`Trusted: ${summary.trusted.passed}/${summary.trusted.total} passed`);
  await log(`Welcomed: ${summary.welcomed.passed}/${summary.welcomed.total} passed`);

  return summary;
}
