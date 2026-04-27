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

export default async function checkJsonLd({
  html,
  url,
}: {
  html: string;
  url: string;
}): Promise<CheckResult & { schemas: JsonLdResult[] }> {
  const scriptMatches = html.matchAll(
    /<script\s+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  const schemas: JsonLdResult[] = [];
  const startTime = Date.now();

  for (const match of scriptMatches) {
    const jsonContent = match[1].trim();
    if (!jsonContent) continue;

    try {
      const parsed = JSON.parse(jsonContent);
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

  const elapsed = Date.now() - startTime;

  if (schemas.length === 0) {
    return {
      name: "JSON-LD",
      category: "optimization",
      passed: false,
      message: "No JSON-LD structured data found",
      details: { url, elapsed },
      schemas: [],
    };
  }

  const validCount = schemas.filter((s) => s.valid).length;
  const invalidSchemas = schemas.filter((s) => !s.valid);

  if (invalidSchemas.length > 0) {
    const errors = invalidSchemas
      .map((s) => `${s.type}: ${s.error}`)
      .join("; ");
    return {
      name: "JSON-LD",
      category: "optimization",
      passed: false,
      message: `${validCount}/${schemas.length} schemas valid (${errors})`,
      details: { url, validCount, totalCount: schemas.length, elapsed },
      schemas,
    };
  }

  const uniqueTypes = [...new Set(schemas.map((s) => s.type))];
  return {
    name: "JSON-LD",
    category: "optimization",
    passed: true,
    message: `Valid JSON-LD: ${uniqueTypes.join(", ")}`,
    details: { url, validCount, totalCount: schemas.length, elapsed },
    schemas,
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
