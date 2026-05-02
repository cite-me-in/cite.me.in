/**
 * Spec: schema.org
 * JSON-LD structured data embedded in <script type="application/ld+json"> tags.
 * Required: ALL reviewed pages must have valid JSON-LD. Passes only if every
 * page has at least one valid JSON-LD schema with all required fields.
 * Per-schema required fields:
 */

import { parseHTML } from "linkedom";
import type { CheckResult } from "~/lib/aiLegibility/types";

const KNOWN_SCHEMAS = [
  "Article",
  "Organization",
  "WebSite",
  "BreadcrumbList",
  "Product",
  "LocalBusiness",
  "Person",
  "FAQPage",
  "HowTo",
  "NewsArticle",
  "BlogPosting",
  "SoftwareApplication",
];

type JsonLdResult = {
  type: string;
  valid: boolean;
  error?: string;
};

type PageLdResult = {
  url: string;
  passed: boolean;
  schemas: JsonLdResult[];
};

function extractSchemas(html: string): JsonLdResult[] {
  const { document } = parseHTML(html);
  const scripts = [
    ...document.querySelectorAll('script[type="application/ld+json"]'),
  ] as HTMLScriptElement[];
  const schemas: JsonLdResult[] = [];

  for (const script of scripts) {
    const jsonContent = (script.textContent ?? "").trim();
    if (!jsonContent) continue;

    try {
      const parsed = JSON.parse(jsonContent) as Record<string, unknown>;
      const nodes = flattenNodes(parsed);

      for (const node of nodes) {
        const type = node["@type"];
        if (typeof type !== "string" || !KNOWN_SCHEMAS.includes(type)) {
          schemas.push({
            type: typeof type === "string" ? type : "unknown",
            valid: true,
          });
          continue;
        }
        const validationError = validateSchema(type, node);
        schemas.push(
          validationError
            ? { type, valid: false, error: validationError }
            : { type, valid: true },
        );
      }
    } catch (error) {
      schemas.push({
        type: "unknown",
        valid: false,
        error: `JSON parse error: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }

  return schemas;
}

export default async function checkJsonLd({
  pages,
}: {
  pages: {
    url: string;
    html: string;
  }[];
}): Promise<
  Omit<CheckResult, "category"> & {
    schemas: JsonLdResult[];
    pageResults?: PageLdResult[];
  }
> {
  const startTime = Date.now();

  const pageResults: PageLdResult[] = [];
  for (const page of pages) {
    const schemas = extractSchemas(page.html);
    const allValid = schemas.length > 0 && schemas.every((s) => s.valid);
    pageResults.push({ url: page.url, passed: allValid, schemas });
  }

  const elapsed = Date.now() - startTime;

  const passed = pageResults.every(
    (p) => p.schemas.length > 0 && p.schemas.every((s) => s.valid),
  );

  const allErrors: string[] = [];
  for (const result of pageResults) {
    const invalid = result.schemas.filter((s) => !s.valid);
    if (invalid.length > 0) {
      allErrors.push(
        `${result.url}: ${invalid
          .map((s) => `${s.type}: ${s.error}`)
          .join("; ")}`,
      );
    }
  }

  const pagesWithValidLd = pageResults.filter(
    (p) => p.schemas.length > 0,
  ).length;
  const pagesPassing = pageResults.filter((p) => p.passed).length;

  const parts: string[] = [];
  parts.push(`${pagesPassing}/${pageResults.length} pages have valid JSON-LD`);

  if (pagesWithValidLd > 0) {
    const uniqueTypes = [
      ...new Set(pageResults.flatMap((p) => p.schemas.map((s) => s.type))),
    ];
    parts.push(`schemas found: ${uniqueTypes.join(", ")}`);
  }

  const pagesWithoutLD = pageResults
    .filter((p) => p.schemas.length === 0)
    .map((p) => p.url);

  const message =
    pageResults.length === 0
      ? "No pages to check"
      : pagesWithoutLD.length > 0 && !passed
        ? `No JSON-LD found on ${pagesWithoutLD.join(", ")}`
        : pagesPassing === pageResults.length
          ? `${pagesPassing}/${pageResults.length} pages have valid JSON-LD`
          : `${pagesPassing}/${pageResults.length} pages have valid JSON-LD, watch for:\n${allErrors.join("\n")}`;
  return {
    name: "JSON-LD",
    passed,
    message,
    details: {
      elapsed,
      pagesRequested: pages.length,
      pagesChecked: pageResults.length,
      anyPageHasValidLd: passed,
    },
    schemas: pageResults[0].schemas,
    pageResults,
  };
}

function flattenNodes(data: unknown): Record<string, unknown>[] {
  if (typeof data !== "object" || data === null) return [];
  if (Array.isArray(data)) return data.flatMap(flattenNodes);

  const obj = data as Record<string, unknown>;
  const nodes: Record<string, unknown>[] = [];

  if (obj["@graph"] && Array.isArray(obj["@graph"]))
    nodes.push(...flattenNodes(obj["@graph"]));
  else if (obj["@type"]) nodes.push(obj);

  return nodes;
}

function validateSchema(type: string, data: unknown): string | null {
  const obj = data as Record<string, unknown>;

  switch (type) {
    case "Article":
    case "NewsArticle":
    case "BlogPosting": {
      return obj.headline || obj.name
        ? null
        : "Missing required field 'headline' or 'name' in Article, NewsArticle, or BlogPosting schemas";
    }
    case "Organization": {
      return obj.name
        ? null
        : "Missing required field 'name' in Organization schema";
    }
    case "WebSite": {
      return obj.name || obj.url
        ? null
        : "Missing required field 'name' or 'url' in WebSite schema";
    }
    case "BreadcrumbList": {
      return obj.itemListElement || obj.itemList
        ? null
        : "Missing required field 'itemListElement' or 'itemList' in BreadcrumbList schema";
    }
    case "Product": {
      return obj.name
        ? null
        : "Missing required field 'name' in Product schema";
    }
    case "Person": {
      return obj.name ? null : "Missing required field 'name' in Person schema";
    }
    case "FAQPage": {
      return obj.mainEntity
        ? null
        : "Missing required field 'mainEntity' in FAQPage schema";
    }
    case "HowTo": {
      return obj.name ? null : "Missing required field 'name' in HowTo schema";
    }
    case "LocalBusiness": {
      return obj.name
        ? null
        : "Missing required field 'name' in LocalBusiness schema";
    }
    case "SoftwareApplication": {
      return obj.name
        ? null
        : "Missing required field 'name' in SoftwareApplication schema";
    }
    default:
      return null;
  }
}
