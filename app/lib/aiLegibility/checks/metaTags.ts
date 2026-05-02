/**
 * Spec: Open Graph Protocol (ogp.me)
 * Required per page: og:title, og:type, og:image, og:url
 * Optional: og:description, og:audio, og:determiner, og:locale, og:site_name, og:video
 */

import type { CheckResult } from "~/lib/aiLegibility/types";

const OG_PROPERTIES = ["og:title", "og:type", "og:image", "og:url"] as const;

function checkPage({
  html,
}: {
  html: string;
}): {
  hasDescription: boolean;
  description: string | undefined;
  canonical: string | undefined;
  ogMatches: Record<string, string | undefined>;
  hasCanonical: boolean;
} {
  const descriptionMatch = html.match(
    /<meta\s+name\s*=\s*["']description["']\s+content\s*=\s*["']([^"']*)["']/i,
  );
  const canonicalMatch = html.match(
    /<link\s+rel\s*=\s*["']canonical["']\s+href\s*=\s*["']([^"']*)["']/i,
  );

  const ogMatches: Record<string, string | undefined> = {};
  for (const prop of OG_PROPERTIES) {
    const match = html.match(
      new RegExp(
        `<meta\\s+property\\s*=\\s*["']${prop}["']\\s+content\\s*=\\s*["']([^"']*)["']`,
        "i",
      ),
    );
    ogMatches[prop] = match?.[1];
  }

  const description = descriptionMatch?.[1];
  const canonical = canonicalMatch?.[1];
  const hasDescription = !!description && description.length > 0;
  const hasCanonical = !!canonical;

  return { hasDescription, description, canonical, ogMatches, hasCanonical };
}

export default async function checkMetaTags({
  pages,
}: {
  pages: { url: string; html: string }[];
}): Promise<Omit<CheckResult, "category">> {
  const startTime = Date.now();

  const pageResults = pages.map((page) => {
    const result = checkPage({ html: page.html });
    const allRequiredOg = OG_PROPERTIES.every((p) => result.ogMatches[p]);
    return { url: page.url, ...result, allRequiredOg };
  });

  const elapsed = Date.now() - startTime;

  const allPassed = pageResults.every(
    (p) => p.hasDescription || p.allRequiredOg || p.hasCanonical,
  );

  if (pageResults.length === 1) {
    const p = pageResults[0];
    const foundOg = OG_PROPERTIES.filter((prop) => p.ogMatches[prop]);

    const found: string[] = [];
    if (p.hasDescription) found.push("description");
    if (p.allRequiredOg) {
      found.push("all 4 required OG tags (title, type, image, url)");
    } else if (foundOg.length > 0) {
      found.push(`partial OG tags (${foundOg.join(", ")})`);
    }
    if (p.hasCanonical) found.push("canonical");

    return {
      name: "Meta tags",
      passed: allPassed,
      message: allPassed
        ? `Found: ${found.join(", ")}`
        : `No meta description, Open Graph tags, or canonical URL found`,
      details: { url: p.url, elapsed },
    };
  }

  const passedCount = pageResults.filter(
    (p) => p.hasDescription || p.allRequiredOg || p.hasCanonical,
  ).length;

  return {
    name: "Meta tags",
    passed: allPassed,
    message: allPassed
      ? `All ${pageResults.length} pages have meta tags`
      : `${passedCount}/${pageResults.length} pages have meta tags`,
    details: { elapsed, pagesChecked: pageResults.length },
  };
}
