type SchemaProperty = {
  type?: string | string[];
  format?: string;
  enum?: string[];
  items?: { type?: string; $ref?: string };
  $ref?: string;
  example?: unknown;
  description?: string;
};

type Schema = {
  properties?: Record<string, SchemaProperty>;
  description?: string;
};

type OpenApiSpec = {
  info: { description?: string };
  servers: { url: string }[];
  paths: Record<
    string,
    {
      get?: {
        summary?: string;
        description?: string;
        parameters?: Array<{
          name: string;
          in: string;
          required?: boolean;
          schema?: SchemaProperty;
          description?: string;
          example?: unknown;
        }>;
        responses?: Record<
          string,
          {
            description?: string;
            content?: {
              "application/json"?: { schema?: { $ref?: string } };
            };
          }
        >;
      };
    }
  >;
  components: { schemas: Record<string, Schema> };
};

type TableRow = { field: string; type: string; example: string };

function resolveType(prop: SchemaProperty): string {
  if (prop.enum) return prop.enum.map((v) => `"${v}"`).join(" | ");
  if (Array.isArray(prop.type)) {
    const nonNull = prop.type.filter((t) => t !== "null");
    return `${nonNull.join(" | ")} | null`;
  }
  if (prop.type === "array" && prop.items) {
    if (prop.items.$ref) {
      const name = prop.items.$ref.replace("#/components/schemas/", "");
      return `${name}[]`;
    }
    return `${prop.items.type ?? "unknown"}[]`;
  }
  return prop.type ?? "unknown";
}

function exampleValue(prop: SchemaProperty): string {
  if (prop.example !== undefined) return String(prop.example);
  if (prop.enum) return `"${prop.enum[0]}"`;
  if (prop.type === "array") return "[]";
  return "";
}

function schemaRows(
  spec: OpenApiSpec,
  schemaName: string,
  prefix = "",
): TableRow[] {
  const schema = spec.components.schemas[schemaName];
  if (!schema?.properties) return [];

  const rows: TableRow[] = [];
  for (const [name, prop] of Object.entries(schema.properties)) {
    const field = prefix ? `${prefix}.${name}` : name;

    if (prop.type === "array" && prop.items?.$ref) {
      const subName = prop.items.$ref.replace("#/components/schemas/", "");
      rows.push({ field, type: `${subName}[]`, example: "" });
      for (const sub of schemaRows(spec, subName, `${field}[]`)) rows.push(sub);
    } else {
      rows.push({
        field,
        type: resolveType(prop),
        example: exampleValue(prop),
      });
    }
  }
  return rows;
}

function responseTable(spec: OpenApiSpec, ref: string): string {
  const name = ref.replace("#/components/schemas/", "");
  const rows = schemaRows(spec, name);
  if (!rows.length) return "";

  const lines = ["| Field | Type | Example |", "| --- | --- | --- |"];
  for (const row of rows)
    lines.push(
      `| \`${row.field}\` | \`${row.type}\` | ${row.example ? `\`${row.example}\`` : ""} |`,
    );
  return lines.join("\n");
}

function pathParamsTable(
  params: NonNullable<
    NonNullable<OpenApiSpec["paths"][string]["get"]>["parameters"]
  >,
): string {
  const pathParams = params.filter((p) => p.in === "path");
  if (!pathParams.length) return "";
  const lines = [
    "#### Path Parameters",
    "| Parameter | Type | Description |",
    "| --- | --- | --- |",
  ];
  for (const p of pathParams)
    lines.push(
      `| \`${p.name}\` | \`${p.schema?.type ?? "string"}\` | ${p.description ?? ""} |`,
    );
  return lines.join("\n");
}

function queryParamsTable(
  params: NonNullable<
    NonNullable<OpenApiSpec["paths"][string]["get"]>["parameters"]
  >,
): string {
  const queryParams = params.filter((p) => p.in === "query");
  if (!queryParams.length) return "";
  const lines = [
    "#### Query Parameters",
    "| Parameter | Type | Required | Description |",
    "| --- | --- | --- | --- |",
  ];
  for (const p of queryParams)
    lines.push(
      `| \`${p.name}\` | \`${p.schema?.type ?? "string"}\` | ${p.required ? "Yes" : "No"} | ${p.description ?? ""} |`,
    );
  return lines.join("\n");
}

function fetchExample(baseUrl: string, path: string): string {
  const url =
    baseUrl +
    path.replace("{domain}", "example.com").replace("{runId}", "clxyz456");

  const hasQuery = path.includes("/runs") && !path.includes("{runId}");
  const fullUrl = hasQuery ? `${url}?since=2024-01-01T00:00:00.000Z` : url;

  return `\`\`\`js
const response = await fetch("${fullUrl}", {
  headers: { Authorization: "Bearer YOUR_API_KEY" }
});
const data = await response.json();
\`\`\``;
}

function statusCodesTable(
  responses: NonNullable<
    NonNullable<OpenApiSpec["paths"][string]["get"]>["responses"]
  >,
): string {
  const lines = ["#### Status Codes", "| Code | Meaning |", "| --- | --- |"];
  for (const [code, resp] of Object.entries(responses))
    lines.push(`| ${code} | ${resp.description ?? ""} |`);
  return lines.join("\n");
}

export function generateApiDocsMarkdown(spec: OpenApiSpec): string {
  const baseUrl = spec.servers[0]?.url;
  const sections: string[] = [];

  sections.push("# cite.me.in API");
  if (spec.info.description) sections.push(spec.info.description);

  sections.push(`## Authentication

All endpoints require a Bearer token in the \`Authorization\` header:

\`\`\`
Authorization: Bearer YOUR_API_KEY
\`\`\`

Retrieve your API key from your [profile page](/profile).`);

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    const op = pathItem.get;
    if (!op) continue;

    const parts: string[] = [];
    parts.push(`### GET ${path}`);
    if (op.description) parts.push(op.description);

    const params = op.parameters ?? [];

    const pathTable = pathParamsTable(params);
    if (pathTable) parts.push(pathTable);

    const queryTable = queryParamsTable(params);
    if (queryTable) parts.push(queryTable);

    const okResponse = op.responses?.["200"];
    const ref = okResponse?.content?.["application/json"]?.schema?.$ref;
    if (ref) {
      parts.push("#### Response: 200");
      parts.push(responseTable(spec, ref));
    }

    if (op.responses) parts.push(statusCodesTable(op.responses));

    parts.push("#### Example");
    parts.push(fetchExample(baseUrl, path));

    sections.push(parts.join("\n\n"));
  }

  return sections.join("\n\n");
}
