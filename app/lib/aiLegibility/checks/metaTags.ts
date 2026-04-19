import type { CheckResult } from "../types";

export default async function checkMetaTags({
  log,
  html,
  url,
}: {
  log: (line: string) => Promise<void>;
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
  await log("Checking meta tags...");
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
    const message =
      "No meta description, Open Graph tags, or canonical URL found";
    await log(`✗ ${message}`);
    return {
      name: "Meta tags",
      category: "optimization",
      passed: false,
      message,
      details: { url, elapsed },
    };
  }

  const found: string[] = [];
  if (hasDescription) found.push("description");
  if (hasOgTags) found.push("Open Graph");
  if (hasCanonical) found.push("canonical");

  const message = `Found: ${found.join(", ")}`;
  await log(`✓ ${message}`);
  return {
    name: "Meta tags",
    category: "optimization",
    passed: true,
    message,
    details: { url, elapsed },
    description,
    ogTitle,
    ogDescription,
    canonical,
  };
}
