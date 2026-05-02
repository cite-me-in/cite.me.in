/**
 * Spec: Open Graph Protocol (ogp.me)
 * Required per page: og:title, og:type, og:image, og:url
 * Optional: og:description, og:audio, og:determiner, og:locale, og:site_name, og:video
 */

import type { CheckResult } from "~/lib/aiLegibility/types";

const OG_PROPERTIES = ["og:title", "og:type", "og:image", "og:url"] as const;

export default async function checkMetaTags({
  html,
  url,
}: {
  html: string;
  url: string;
}): Promise<
  Omit<CheckResult, "category"> & {
    description?: string;
    ogTitle?: string;
    ogType?: string;
    ogImage?: string;
    ogUrl?: string;
    ogDescription?: string;
    canonical?: string;
  }
> {
  const startTime = Date.now();

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
  const ogDescriptionMatch = html.match(
    /<meta\s+property\s*=\s*["']og:description["']\s+content\s*=\s*["']([^"']*)["']/i,
  );

  const description = descriptionMatch?.[1];
  const canonical = canonicalMatch?.[1];
  const ogTitle = ogMatches["og:title"];
  const ogType = ogMatches["og:type"];
  const ogImage = ogMatches["og:image"];
  const ogUrl = ogMatches["og:url"];
  const ogDescription = ogDescriptionMatch?.[1];

  const elapsed = Date.now() - startTime;

  const hasDescription = !!description && description.length > 0;
  const hasCanonical = !!canonical;

  const foundOg: string[] = [];
  if (ogTitle) foundOg.push("og:title");
  if (ogType) foundOg.push("og:type");
  if (ogImage) foundOg.push("og:image");
  if (ogUrl) foundOg.push("og:url");

  const allRequiredOg = OG_PROPERTIES.every((p) => ogMatches[p]);
  const anyOg = foundOg.length > 0;

  if (!hasDescription && !anyOg && !hasCanonical) {
    return {
      name: "Meta tags",
      passed: false,
      message: "No meta description, Open Graph tags, or canonical URL found",
      details: { url, elapsed },
    };
  }

  const found: string[] = [];
  if (hasDescription) found.push("description");
  if (allRequiredOg) {
    found.push("all 4 required OG tags (title, type, image, url)");
  } else if (anyOg) {
    found.push(`partial OG tags (${foundOg.join(", ")})`);
  }
  if (hasCanonical) found.push("canonical");

  const passed = allRequiredOg || hasDescription || hasCanonical;

  return {
    name: "Meta tags",
    passed,
    message: passed
      ? `Found: ${found.join(", ")}`
      : `Missing required Open Graph tags (found ${foundOg.length}/4): ${OG_PROPERTIES.filter((p) => !ogMatches[p]).join(", ")}`,
    details: {
      url,
      elapsed,
      ogProperties: {
        title: !!ogTitle,
        type: !!ogType,
        image: !!ogImage,
        url: !!ogUrl,
        description: !!ogDescription,
      },
    },
    description,
    ogTitle,
    ogType,
    ogImage,
    ogUrl,
    ogDescription,
    canonical,
  };
}
