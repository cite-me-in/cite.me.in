/**
 * Spec: Open Graph Protocol (ogp.me)
 * Required per page: og:title, og:type, og:image, og:url
 * Optional: og:description, og:audio, og:determiner, og:locale, og:site_name, og:video
 */

import { parseHTML } from "linkedom";
import type { CheckResult } from "~/lib/aiLegibility/types";

const OG_PROPERTIES = ["og:title", "og:type", "og:image", "og:url"] as const;

function checkPage(html: string): {
  hasDescription: boolean;
  description: string | undefined;
  canonical: string | undefined;
  ogMatches: Record<string, string | undefined>;
  hasCanonical: boolean;
  allRequiredOg: boolean;
} {
  const { document } = parseHTML(html);

  const descriptionEl = document.querySelector(
    'meta[name="description"]',
  ) as HTMLMetaElement | null;
  const description = descriptionEl?.getAttribute("content") ?? undefined;
  const hasDescription = !!description && description.length > 0;

  const canonicalEl = document.querySelector(
    'link[rel="canonical"]',
  ) as HTMLLinkElement | null;
  const canonical = canonicalEl?.getAttribute("href") ?? undefined;
  const hasCanonical = !!canonical;

  const ogMatches: Record<string, string | undefined> = {};
  for (const prop of OG_PROPERTIES) {
    const el = document.querySelector(
      `meta[property="${prop}"]`,
    ) as HTMLMetaElement | null;
    ogMatches[prop] = el?.getAttribute("content") ?? undefined;
  }

  const allRequiredOg = OG_PROPERTIES.every((p) => ogMatches[p]);

  return {
    hasDescription,
    description,
    canonical,
    ogMatches,
    hasCanonical,
    allRequiredOg,
  };
}

export default async function checkMetaTags({
  pages,
}: {
  pages: { url: string; html: string }[];
}): Promise<Omit<CheckResult, "category">> {
  const startTime = Date.now();

  const pageResults = pages.map((page) => ({
    url: page.url,
    ...checkPage(page.html),
  }));

  const elapsed = Date.now() - startTime;

  const allPassed = pageResults.every(
    (page) => page.hasDescription || page.allRequiredOg || page.hasCanonical,
  );

  const passedCount = pageResults.filter(
    (page) => page.hasDescription || page.allRequiredOg || page.hasCanonical,
  ).length;

  if (allPassed) {
    if (pages.length === 1) {
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
        passed: true,
        message: `Found: ${found.join(", ")}`,
        details: { elapsed },
      };
    }
    return {
      name: "Meta tags",
      passed: true,
      message: `All ${pages.length} pages have meta tags`,
      details: { elapsed, pagesChecked: pages.length },
    };
  }

  return pages.length === 1
    ? {
        name: "Meta tags",
        passed: false,
        message: "No meta description, Open Graph tags, or canonical URL found",
        details: { elapsed },
      }
    : {
        name: "Meta tags",
        passed: false,
        message: `${passedCount}/${pages.length} pages have meta tags`,
        details: { elapsed, pagesChecked: pages.length },
      };
}
