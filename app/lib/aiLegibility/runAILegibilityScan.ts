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
import checkRobotsDirectives from "./checks/robotsDirectives";
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

  await log("Checking robots.txt...");
  const robotsTxtResult = await checkRobotsTxt({ url });
  await log(`${robotsTxtResult.passed ? "✓" : "✗"} ${robotsTxtResult.message}`);
  checks.push(robotsTxtResult);

  const robotsSitemapUrls = robotsTxtResult.details?.sitemapUrls as
    | string[]
    | undefined;

  await log("Checking sitemap.xml...");
  const sitemmapXmlResult = await checkSitemapXml({ url, robotsSitemapUrls });
  checks.push(sitemmapXmlResult);
  await log(
    `${sitemmapXmlResult.passed ? "✓" : "✗"} ${sitemmapXmlResult.message}`,
  );

  await log("Checking sitemap.txt...");
  const sitemapTxtResult = await checkSitemapTxt({ url, robotsSitemapUrls });
  await log(
    `${sitemapTxtResult.passed ? "✓" : "✗"} ${sitemapTxtResult.message}`,
  );
  checks.push(sitemapTxtResult);

  await log("Checking sample pages...");
  const urlsFrom = (result: { urls: string[] }) => result.urls;
  let sampleURLs = shuffle([
    ...new Set([
      ...urlsFrom(sitemmapXmlResult),
      ...urlsFrom(sitemapTxtResult),
    ]).values(),
  ]).slice(0, 10);

  if (sampleURLs.length === 0 && homepageResult.html) {
    const links = homepageResult.html.matchAll(
      /<a[^>]+href\s*=\s*["']([^"']+)["'][^>]*>/gi,
    );
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

  const pagesToFetch = sampleURLs.filter((u) => u !== url);
  const fetchedPages = await fetchPages(pagesToFetch);
  const samplePagesResult = await checkSamplePages({ pages: fetchedPages });
  checks.push(samplePagesResult);
  await log(
    `${samplePagesResult.passed ? "✓" : "✗"} ${samplePagesResult.message}`,
  );

  const reviewedPages = [
    {
      url,
      html: homepageResult.html,
      headers: Object.fromEntries(
        homepageResult.responseHeaders?.entries() ?? [],
      ),
    },
    ...fetchedPages,
  ];

  await log("Checking JSON-LD...");
  const jsonLdResult = await checkJsonLd({
    pages: reviewedPages.map((p) => ({ url: p.url, html: p.html })),
  });
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

  await log("Checking sitemap link headers...");
  const linkHeadersResult = await checkLinkHeaders({
    html: homepageResult.html,
    links: homepageResult.responseHeaders,
  });
  checks.push(linkHeadersResult);
  await log(
    `${linkHeadersResult.passed ? "✓" : "✗"} ${linkHeadersResult.message}`,
  );

  await log("Checking markdown alternate links...");
  const markdownAlternateResult = await checkMarkdownAlternateLinks({
    pages: reviewedPages,
  });
  checks.push(markdownAlternateResult);
  await log(
    `${markdownAlternateResult.passed ? "✓" : "✗"} ${markdownAlternateResult.message}`,
  );

  const alternateUrls = markdownAlternateResult.details?.alternateUrls as
    | string[]
    | undefined;

  await log("Checking .md routes...");
  const mdRoutesResult = await checkMdRoutes({ urls: alternateUrls ?? [] });
  checks.push(mdRoutesResult);
  await log(`${mdRoutesResult.passed ? "✓" : "✗"} ${mdRoutesResult.message}`);

  await log("Checking robots directives (noindex)...");
  const robotsDirectivesResult = await checkRobotsDirectives({
    pages: reviewedPages,
  });
  checks.push(robotsDirectivesResult);
  await log(
    `${robotsDirectivesResult.passed ? "✓" : "✗"} ${robotsDirectivesResult.message}`,
  );

  await log("Checking markdown content negotiation...");
  const markdownResult = await checkMarkdownNegotiation({
    pages: [{ url }, ...fetchedPages.map((p) => ({ url: p.url }))],
  });
  checks.push(markdownResult);
  await log(`${markdownResult.passed ? "✓" : "✗"} ${markdownResult.message}`);

  await log("Checking Content-Signal in robots.txt...");
  const contentSignalsResult = await checkContentSignals({
    url,
    robotsContent: robotsTxtResult.details?.robotsContent as string | undefined,
  });
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

async function fetchPages(
  urls: string[],
): Promise<
  {
    url: string;
    html: string;
    ok: boolean;
    status: number;
    timedOut: boolean;
    error?: string;
    headers: Record<string, string>;
  }[]
> {
  const results: {
    url: string;
    html: string;
    ok: boolean;
    status: number;
    timedOut: boolean;
    error?: string;
    headers: Record<string, string>;
  }[] = [];
  for (const pageUrl of urls) {
    try {
      const response = await fetch(pageUrl, {
        headers: {
          "User-Agent": "CiteMeIn-AI-Legibility-Bot/1.0",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(10_000),
      });
      const html = await response.text();
      const headers: Record<string, string> = {};
      const link = response.headers.get("Link");
      const xRobots = response.headers.get("X-Robots-Tag");
      const contentType = response.headers.get("Content-Type");
      if (link) headers["Link"] = link;
      if (xRobots) headers["X-Robots-Tag"] = xRobots;
      if (contentType) headers["Content-Type"] = contentType;
      results.push({ url: pageUrl, html, ok: response.ok, status: response.status, timedOut: false, headers });
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        results.push({ url: pageUrl, html: "", ok: false, status: 0, timedOut: true, error: "Timed out (10s limit)", headers: {} });
      } else {
        results.push({ url: pageUrl, html: "", ok: false, status: 0, timedOut: false, error: error instanceof Error ? error.message : "Unknown error", headers: {} });
      }
    }
  }
  return results;
}
