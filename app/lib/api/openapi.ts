// app/lib/openapi.ts
import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import {
  RunDetailSchema,
  RunsSchema,
  SiteSchema,
  UserSchema,
} from "~/lib/api/schemas";
import envVars from "../envVars";

const registry = new OpenAPIRegistry();

registry.registerComponent("securitySchemes", "BearerAuth", {
  type: "http",
  scheme: "bearer",
  description: "Per-user API key from your profile page",
});

registry.registerPath({
  method: "get",
  path: "/api/me/{email}",
  summary: "Get my details",
  description:
    "Gets the details of the current user. Includes all the sites they have access to. You can only use this endpoint with your own email address.",
  security: [{ BearerAuth: [] }],
  request: {
    params: z.object({
      email: z
        .email()
        .openapi({ example: "user@example.com" })
        .describe("The email address of the user to get details for"),
    }),
  },
  responses: {
    200: {
      description: "User details with sites",
      content: { "application/json": { schema: UserSchema } },
    },
    401: { description: "Unauthorized — missing or invalid API key" },
    403: {
      description: "Forbidden — API key does not have access to this user",
    },
    404: { description: "User not found" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/sites/{domain}",
  summary: "Get site details",
  description:
    "Gets the details of a site you have access to, and lists all the users with access to that site and their roles.",
  security: [{ BearerAuth: [] }],
  request: {
    params: z.object({
      domain: z.string().openapi({ example: "example.com" }),
    }),
  },
  responses: {
    200: {
      description: "Site details with users",
      content: { "application/json": { schema: SiteSchema } },
    },
    401: { description: "Unauthorized — missing or invalid API key" },
    403: {
      description: "Forbidden — API key does not have access to this site",
    },
    404: { description: "Site not found" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/sites/{domain}/runs",
  summary: "List citation runs",
  description:
    "Lists up to 100 citation runs for a site, newest first. Use `?since=<ISO date>` to filter. The date filter is optional and defaults to the last 30 days. For each platform/model, provides the total number of queries and total number of citations",
  security: [{ BearerAuth: [] }],
  request: {
    params: z.object({
      domain: z.string().openapi({ example: "example.com" }),
    }),
    query: z.object({
      since: z.iso.date().optional().openapi({
        example: "2024-01-01",
        description: "Only returns runs created after this ISO 8601 timestamp",
      }),
      limit: z.number().int().optional().openapi({
        example: 100,
        description: "The maximum number of runs to return. Defaults to 100.",
      }),
    }),
  },
  responses: {
    200: {
      description: "List of citation runs",
      content: { "application/json": { schema: RunsSchema } },
    },
    401: { description: "Unauthorized" },
    403: { description: "Forbidden" },
    404: { description: "Site not found" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/sites/{domain}/runs/{runId}",
  summary: "Get run detail",
  description:
    "Gets a single citation run with all its queries. For each query, includes the query text, the group it belongs to, and all the citations for that query.",
  security: [{ BearerAuth: [] }],
  request: {
    params: z.object({
      domain: z.string().openapi({ example: "example.com" }),
      runId: z.string().openapi({ example: "clxyz456" }),
    }),
  },
  responses: {
    200: {
      description: "Run detail with queries and citations",
      content: { "application/json": { schema: RunDetailSchema } },
    },
    401: { description: "Unauthorized" },
    403: { description: "Forbidden" },
    404: { description: "Run not found" },
  },
});

export function generateOpenApiSpec() {
  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "cite.me.in Monitoring API",
      version: "1.0.0",
      description:
        "Monitor your brand's visibility in AI-generated responses. Authenticate with your API key from the profile page. See the [documentation](https://cite.me.in/docs) for more information.",
    },
    servers: [{ url: envVars.VITE_APP_URL }],
  });
}
