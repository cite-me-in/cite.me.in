import { alphabetical } from "radashi";
import type {
  ZodOpenApiHeaderObject,
  ZodOpenApiParameterObject,
  ZodOpenApiResponseObject,
  ZodOpenApiSchemaObject,
  createDocument,
} from "zod-openapi";

/**
 * Generate Markdown documentation for the entire OpenAPI spec.
 *
 * @param spec - The OpenAPI spec to generate documentation for.
 * @returns The generated Markdown documentation as a string
 */
export function generateApiDocsMarkdown(
  spec: ReturnType<typeof createDocument>,
): string {
  if (!spec.servers) return "";
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

  for (const [path, pathItem] of Object.entries(spec.paths ?? {})) {
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
    const schema = okResponse?.content?.["application/json"]?.schema;
    if (schema) {
      parts.push("#### Response: 200");
      parts.push(responseTable(schema));
    }

    if (op.responses) parts.push(statusCodesTable(op.responses));

    parts.push("#### Example");
    parts.push(fetchExample(baseUrl, path));

    sections.push(parts.join("\n\n"));
  }

  return sections.join("\n\n");
}

/**
 * Generate Markdown table of path parameters from the given OpenAPI spec.
 *
 * @param params - The path parameters to generate the table from.
 * @returns The generated Markdown table of path parameters as a string.
 */
function pathParamsTable(
  params: (ZodOpenApiParameterObject | ZodOpenApiHeaderObject)[],
): string {
  const pathParams = params.filter(
    (param) => "in" in param && param.in === "path",
  );
  if (!pathParams.length) return "";

  const lines = [
    "#### Path Parameters",
    "| Parameter | Type | Description |",
    "| --- | --- | --- |",
  ];
  for (const param of pathParams) {
    if ("name" in param)
      lines.push(
        `| \`${param.name}\` | \`${
          param.schema && "type" in param.schema ? param.schema.type : "string"
        }\` | ${param.description ?? ""} |`,
      );
  }
  return lines.join("\n");
}

/**
 * Generate Markdown table of query parameters from the given OpenAPI spec.
 *
 * @param params - The query parameters to generate the table from.
 * @returns The generated Markdown table of query parameters as a string.
 */
function queryParamsTable(
  params: (ZodOpenApiParameterObject | ZodOpenApiHeaderObject)[],
): string {
  const queryParams = params.filter(
    (param) => "in" in param && param.in === "query",
  );
  if (!queryParams.length) return "";
  const lines = [
    "#### Query Parameters",
    "| Parameter | Type | Required | Description |",
    "| --- | --- | --- | --- |",
  ];
  for (const param of queryParams) {
    if ("name" in param)
      lines.push(
        `| \`${param.name}\` | \`${
          param.schema && "type" in param.schema ? param.schema.type : "string"
        }\` | ${param.required ? "Yes" : "No"} | ${param.description ?? ""} |`,
      );
  }
  return lines.join("\n");
}

/**
 * Generate Markdown table of response fields from the given OpenAPI spec.
 *
 * @param schema - The schema to generate the table from.
 * @returns The generated Markdown table of response fields as a string.
 */
function responseTable(schema: ZodOpenApiSchemaObject): string {
  const properties =
    "properties" in schema && schema.properties
      ? Object.entries(schema.properties)
      : [];
  if (!properties.length) return "";

  const lines = ["| Field | Type | Description |", "| --- | --- | --- |"];
  for (const [name, prop] of alphabetical(properties, ([n]) => n))
    addSchemaProperty({ name, prop, lines });
  return lines.join("\n");
}

/**
 * Add one or more lines about the property. Adds multiple lines if the property
 * is an object or array of objects.
 *
 * @param lines - The lines to add the property to.
 * @param name - The name of the property.
 * @param parent - The parent of the property.
 * @param prop - The schema property of the property.
 */
function addSchemaProperty({
  lines,
  name,
  parent,
  prop,
}: {
  lines: string[];
  name: string;
  parent?: string;
  prop: ZodOpenApiSchemaObject;
}) {
  const type = "type" in prop ? (prop.type as string) : "unknown";
  if (
    type === "array" &&
    "items" in prop &&
    prop.items &&
    "properties" in prop.items
  ) {
    const properties = prop.items.properties ?? {};
    const thisParent = `${parent ?? ""}${name}[].`;
    for (const [name, prop] of alphabetical(Object.entries(properties), ([n]) => n))
      addSchemaProperty({ name, prop, lines, parent: thisParent });
  } else if (type === "object" && "properties" in prop && prop.properties) {
    const properties = prop.properties;
    const thisParent = `${parent ?? ""}${name}.`;
    for (const [name, prop] of alphabetical(Object.entries(properties), ([n]) => n))
      addSchemaProperty({ name, prop, lines, parent: thisParent });
  } else {
    lines.push(
      `| \`${parent ?? ""}${name}\` | \`${encodeForMarkdown(type)}\` | ${
        "description" in prop ? prop.description : ""
      } |`,
    );
  }
}

/**
 * Generate Markdown table of status codes for the given OpenAPI spec.
 *
 * @param responses - The status codes and descriptions to generate the table for.
 * @returns The generated Markdown table of status codes and descriptions as a string.
 */
function statusCodesTable(
  responses: Record<string, ZodOpenApiResponseObject>,
): string {
  const lines = ["#### Status Codes", "| Code | Meaning |", "| --- | --- |"];
  for (const [code, resp] of Object.entries(responses))
    lines.push(`| ${code} | ${resp.description ?? ""} |`);
  return lines.join("\n");
}

/**
 * Generate a fetch example for the given base URL and path.
 *
 * @param baseUrl - The base URL to generate the fetch example from.
 * @param path - The path to generate the fetch example from.
 * @returns The generated fetch example as a string.
 */
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

/**
 * Encodes a value string so it is not interpreted as Markdown.
 * Escapes pipe "|" and backtick "`" characters, and wraps in backticks as needed.
 *
 * @param value - The value to encode.
 * @returns The encoded value as a string safe for Markdown tables.
 */
function encodeForMarkdown(value?: string): string {
  if (!value) return "";
  // Escape pipe and backtick, and replace common issues
  const v = String(value).replace(/\|/g, "\\|").replace(/`/g, "\\`");
  // Optionally add extra escaping if needed for newlines
  return `\`${v}\``;
}
