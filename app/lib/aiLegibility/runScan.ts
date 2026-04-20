import { shuffle } from "radashi";
import { normalizeURL } from "~/lib/isSameDomain";
import checkHomepageContent from "./checks/homepageContent";
import checkJsonLd from "./checks/jsonLd";
import checkLlmsTxt from "./checks/llmsTxt";
import checkMetaTags from "./checks/metaTags";
import checkRobotsTxt from "./checks/robotsTxt";
import checkSamplePages from "./checks/samplePages";
import checkSitemapTxt from "./checks/sitemapTxt";
import checkSitemapXml from "./checks/sitemapXml";
import { withMinDelay } from "./delay";
import generateSuggestions from "./generateSuggestions";
import type { CheckResult, ScanResult } from "./types";

export async function runScan({
  log,
  domain,
}: {
  log: (line: string) => Promise<void>;
  domain: string;
}): Promise<ScanResult> {
  const url = normalizeURL(domain);
  const checks: CheckResult[] = [];

  const homepageResult = await withMinDelay(() =>
    checkHomepageContent({ log, url }),
  );
  checks.push(homepageResult);

  const sitemmapXmlResult = await withMinDelay(() =>
    checkSitemapXml({ log, url }),
  );
  checks.push(sitemmapXmlResult);
  const sitemapTxtResult = await withMinDelay(() =>
    checkSitemapTxt({ log, url }),
  );
  checks.push(sitemapTxtResult);

  checks.push(await withMinDelay(() => checkRobotsTxt({ log, url })));
  checks.push(
    await withMinDelay(() =>
      checkJsonLd({ log, html: homepageResult.html, url }),
    ),
  );
  checks.push(
    await withMinDelay(() =>
      checkMetaTags({ log, html: homepageResult.html, url }),
    ),
  );
  checks.push(await withMinDelay(() => checkLlmsTxt({ log, url })));

  const sampleURLs = shuffle([
    ...new Set([...sitemmapXmlResult.urls, ...sitemapTxtResult.urls]).values(),
  ]).slice(0, 10);
  checks.push(
    await withMinDelay(() => checkSamplePages({ log, url, sampleURLs })),
  );

  const summary = await summarize({ checks, log });
  const suggestions = await withMinDelay(() =>
    generateSuggestions({ log, checks, url }),
  );

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
