/**
 * Spec: schema.org
 * JSON-LD structured data embedded in <script type="application/ld+json"> tags.
 * Required: at least one page (homepage or sample page) must have valid JSON-LD.
 * Per-schema required fields:
 *   - Article/NewsArticle/BlogPosting: headline or name
 *   - Organization: name
 *   - WebSite: name or url
 *   - BreadcrumbList: itemListElement
 *   - Product: name
 *   - Person: name
 *   - FAQPage: mainEntity
 *   - HowTo: name
 *   - LocalBusiness: name
 *   - SoftwareApplication: name
 */

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
  const scriptMatches = html.matchAll(
    /<script\s+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  const schemas: JsonLdResult[] = [];

  for (const match of scriptMatches) {
    const jsonContent = match[1].trim();
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
            error: "Unknown schema type",
          });
          continue;
        }
        const validation = validateSchema(type, node);
        schemas.push({
          type,
          valid: validation.valid,
          error: validation.error,
        });
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
  html,
  url,
  pages,
}: {
  html: string;
  url: string;
  pages?: { url: string; html?: string }[];
}): Promise<
  Omit<CheckResult, "category"> & {
    schemas: JsonLdResult[];
    pageResults?: PageLdResult[];
  }
> {
  const startTime = Date.now();
  const homepageSchemas = extractSchemas(html);

  const pageResults: PageLdResult[] = [];
  const pagesRequested = pages?.length ?? 0;
  if (pages) {
    for (const page of pages) {
      if (!page.html) continue;
      const schemas = extractSchemas(page.html);
      const allValid = schemas.length > 0 && schemas.every((s) => s.valid);
      pageResults.push({ url: page.url, passed: allValid, schemas });
    }
  }

  const elapsed = Date.now() - startTime;

  const allPageResults = [
    { url: "homepage", schemas: homepageSchemas },
    ...pageResults,
  ];

  const anyHasValidLd = allPageResults.some(
    (p) => p.schemas.length > 0 && p.schemas.every((s) => s.valid),
  );

  const allErrors: string[] = [];
  for (const result of allPageResults) {
    const invalid = result.schemas.filter((s) => !s.valid);
    if (invalid.length > 0) {
      allErrors.push(
        `${result.url}: ${invalid
          .map((s) => `${s.type}: ${s.error}`)
          .join("; ")}`,
      );
    }
  }

  const parts: string[] = [];

  if (homepageSchemas.length > 0) {
    const uniqueTypes = [...new Set(homepageSchemas.map((s) => s.type))];
    parts.push(`Homepage: valid JSON-LD (${uniqueTypes.join(", ")})`);
  } else if (pageResults.some((p) => p.schemas.length > 0)) {
    parts.push("Homepage: no JSON-LD, found on sample pages");
  } else {
    parts.push("Homepage: no JSON-LD");
  }

  if (pagesRequested > 0 && pageResults.length === 0) {
    parts.push("Sample pages: none could be fetched");
  } else if (pageResults.length > 0) {
    const withLd = pageResults.filter((p) => p.schemas.length > 0).length;
    const validPages = pageResults.filter((p) => p.passed);
    if (withLd === 0) {
      parts.push("Sample pages: no JSON-LD found");
    } else {
      parts.push(
        `Sample pages: ${validPages.length}/${pageResults.length} have valid JSON-LD`,
      );
    }
  }

  const noLdAnywhere = allPageResults.every((p) => p.schemas.length === 0);
  const passed = anyHasValidLd;

  let message: string;
  if (noLdAnywhere) {
    message = "No JSON-LD found on homepage or sample pages";
  } else if (!passed) {
    message = ["JSON-LD found but all schemas are invalid", ...allErrors].join(
      " | ",
    );
  } else {
    message = parts.join("; ");
    if (allErrors.length > 0) {
      message += ` | Warnings: ${allErrors.join("; ")}`;
    }
  }

  return {
    name: "JSON-LD",
    passed,
    message,
    details: {
      url,
      elapsed,
      homepageSchemaCount: homepageSchemas.length,
      pagesRequested,
      pagesChecked: pageResults.length,
      anyPageHasValidLd: anyHasValidLd,
    },
    schemas: homepageSchemas,
    pageResults,
  };
}

function flattenNodes(data: unknown): Record<string, unknown>[] {
  if (typeof data !== "object" || data === null) return [];
  if (Array.isArray(data)) return data.flatMap(flattenNodes);

  const obj = data as Record<string, unknown>;
  const nodes: Record<string, unknown>[] = [];

  if (obj["@graph"] && Array.isArray(obj["@graph"])) {
    nodes.push(...flattenNodes(obj["@graph"]));
  } else if (obj["@type"]) {
    nodes.push(obj);
  }

  return nodes;
}

function validateSchema(
  type: string,
  data: unknown,
): { valid: boolean; error?: string } {
  const obj = data as Record<string, unknown>;

  switch (type) {
    case "Article":
    case "NewsArticle":
    case "BlogPosting": {
      if (!obj.headline && !obj.name) {
        return {
          valid: false,
          error: "Missing required field 'headline' or 'name'",
        };
      }
      return { valid: true };
    }
    case "Organization": {
      if (!obj.name) {
        return { valid: false, error: "Missing required field 'name'" };
      }
      return { valid: true };
    }
    case "WebSite": {
      if (!obj.name && !obj.url) {
        return {
          valid: false,
          error: "Missing required field 'name' or 'url'",
        };
      }
      return { valid: true };
    }
    case "BreadcrumbList": {
      if (!obj.itemListElement && !obj.itemList) {
        return {
          valid: false,
          error: "Missing required field 'itemListElement'",
        };
      }
      return { valid: true };
    }
    case "Product": {
      if (!obj.name) {
        return { valid: false, error: "Missing required field 'name'" };
      }
      return { valid: true };
    }
    case "Person": {
      if (!obj.name) {
        return { valid: false, error: "Missing required field 'name'" };
      }
      return { valid: true };
    }
    case "FAQPage": {
      if (!obj.mainEntity) {
        return { valid: false, error: "Missing required field 'mainEntity'" };
      }
      return { valid: true };
    }
    case "HowTo": {
      if (!obj.name) {
        return { valid: false, error: "Missing required field 'name'" };
      }
      return { valid: true };
    }
    case "LocalBusiness": {
      if (!obj.name) {
        return { valid: false, error: "Missing required field 'name'" };
      }
      return { valid: true };
    }
    case "SoftwareApplication": {
      if (!obj.name) {
        return { valid: false, error: "Missing required field 'name'" };
      }
      return { valid: true };
    }
    default:
      return { valid: true };
  }
}
