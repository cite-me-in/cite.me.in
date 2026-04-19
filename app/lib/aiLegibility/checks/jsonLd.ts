import type { CheckResult } from "../types";

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
  log,
  html,
  url,
}: {
  log: (line: string) => Promise<void>;
  html: string;
  url: string;
}): Promise<CheckResult & { schemas: JsonLdResult[] }> {
  await log("Checking JSON-LD structured data...");
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
      const types = extractTypes(parsed);

      for (const type of types) {
        if (KNOWN_SCHEMAS.includes(type)) {
          const validation = validateSchema(type, parsed);
          schemas.push({
            type,
            valid: validation.valid,
            error: validation.error,
          });
        } else {
          schemas.push({
            type,
            valid: true,
            error: "Unknown schema type (not validated)",
          });
        }
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
    const message = "No JSON-LD structured data found";
    await log(`✗ ${message}`);
    return {
      name: "JSON-LD",
      category: "important",
      passed: false,
      message,
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
    const message = `${validCount}/${schemas.length} schemas valid (${errors})`;
    await log(`✗ ${message}`);
    return {
      name: "JSON-LD",
      category: "important",
      passed: false,
      message,
      details: { url, validCount, totalCount: schemas.length, elapsed },
      schemas,
    };
  }

  const uniqueTypes = [...new Set(schemas.map((s) => s.type))];
  const message = `Valid JSON-LD: ${uniqueTypes.join(", ")}`;
  await log(`✓ ${message}`);
  return {
    name: "JSON-LD",
    category: "important",
    passed: true,
    message,
    details: { url, validCount, totalCount: schemas.length, elapsed },
    schemas,
  };
}

function extractTypes(data: unknown): string[] {
  if (typeof data !== "object" || data === null) return [];

  if (Array.isArray(data)) {
    return data.flatMap(extractTypes);
  }

  const obj = data as Record<string, unknown>;
  const types: string[] = [];

  if (obj["@type"]) {
    const t = obj["@type"];
    if (typeof t === "string") {
      types.push(t);
    } else if (Array.isArray(t)) {
      types.push(...t.filter((x): x is string => typeof x === "string"));
    }
  }

  if (obj["@graph"] && Array.isArray(obj["@graph"])) {
    types.push(...obj["@graph"].flatMap(extractTypes));
  }

  return types;
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
