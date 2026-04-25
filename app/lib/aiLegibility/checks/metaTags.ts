import type { CheckResult } from "~/lib/aiLegibility/types";

export default async function checkMetaTags({
  html,
  url,
}: {
  html: string;
  url: string;
}): Promise<
  CheckResult & {
    description?: string;
    ogTitle?: string;
    ogDescription?: string;
    canonical?: string;
  }
> {
  const startTime = Date.now();

  const descriptionMatch = html.match(
    /<meta\s+name\s*=\s*["']description["']\s+content\s*=\s*["']([^"']*)["']/i,
  );
  const ogTitleMatch = html.match(
    /<meta\s+property\s*=\s*["']og:title["']\s+content\s*=\s*["']([^"']*)["']/i,
  );
  const ogDescriptionMatch = html.match(
    /<meta\s+property\s*=\s*["']og:description["']\s+content\s*=\s*["']([^"']*)["']/i,
  );
  const canonicalMatch = html.match(
    /<link\s+rel\s*=\s*["']canonical["']\s+href\s*=\s*["']([^"']*)["']/i,
  );

  const description = descriptionMatch?.[1];
  const ogTitle = ogTitleMatch?.[1];
  const ogDescription = ogDescriptionMatch?.[1];
  const canonical = canonicalMatch?.[1];

  const elapsed = Date.now() - startTime;

  const hasDescription = !!description && description.length > 0;
  const hasOgTags = !!(ogTitle || ogDescription);
  const hasCanonical = !!canonical;

  if (!hasDescription && !hasOgTags && !hasCanonical) {
    return {
      name: "Meta tags",
      category: "optimization",
      passed: false,
      message: "No meta description, Open Graph tags, or canonical URL found",
      details: { url, elapsed },
    };
  }

  const found: string[] = [];
  if (hasDescription) found.push("description");
  if (hasOgTags) found.push("Open Graph");
  if (hasCanonical) found.push("canonical");

  return {
    name: "Meta tags",
    category: "optimization",
    passed: true,
    message: `Found: ${found.join(", ")}`,
    details: { url, elapsed },
    description,
    ogTitle,
    ogDescription,
    canonical,
  };
}
