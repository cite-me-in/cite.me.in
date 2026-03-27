import { z } from "zod";
import { createDocument } from "zod-openapi";
import envVars from "~/lib/envVars";

export const UserSchema = z.object({
  email: z.email().describe("The email address of the user"),
  sites: z.array(
    z.object({
      domain: z.string().describe("The domain of the site e.g. `example.com`"),
      createdAt: z.iso
        .date()
        .describe("The date the site was created e.g. `2024-01-01`"),
    }),
  ),
});

export const SiteSchema = z.object({
  content: z
    .string()
    .describe(
      "The content of the site, originally retrieved from the website (Markdown format).",
    ),
  createdAt: z.iso
    .date()
    .describe("The date the site was created e.g. `2024-01-01`"),
  domain: z.string().describe("The domain of the site e.g. `example.com`"),
  summary: z
    .string()
    .describe("The summary of the site e.g. `This product is fantastic`"),
  users: z.array(
    z
      .object({
        email: z
          .email()
          .describe("The email address of the user e.g. `user@example.com`"),
        role: z
          .enum(["owner", "member"])
          .describe(
            "The role of the user on the site e.g. `owner` or `member`",
          ),
      })
      .describe("The users of the site"),
  ),
});

export const SiteMetricsSchema = z.object({
  allCitations: z.object({
    current: z.number().int().describe("Total citations for the current week"),
    previous: z
      .number()
      .int()
      .describe("Total citations for the previous week"),
  }),
  yourCitations: z.object({
    current: z
      .number()
      .int()
      .describe("Your citations only for the current week"),
    previous: z
      .number()
      .int()
      .describe("Your citations only for the previous week"),
  }),
  visbilityScore: z.object({
    current: z
      .number()
      .int()
      .describe("LLM visibility score for the current week"),
    previous: z
      .number()
      .int()
      .describe("LLM visibility score for the previous week"),
  }),
  botVisits: z.object({
    current: z
      .number()
      .int()
      .describe("Total unique bot visits for the current week"),
    previous: z
      .number()
      .int()
      .describe("Total unique bot visits for the previous week"),
  }),
});

export const SiteQueriesSchema = z.object({
  platforms: z.array(
    z.object({
      model: z
        .string()
        .describe("The model used for the queries e.g. `gpt-5-chat-latest`"),
      onDate: z.iso
        .date()
        .describe("The date these queries were inspected e.g. `2024-01-01`"),
      platform: z
        .string()
        .describe("The platform used for the queries e.g. `chatgpt`"),
      queries: z.array(
        z.object({
          citations: z
            .array(z.url())
            .describe(
              "The citations in the query response e.g. `https://example.com/page1`",
            ),
          group: z
            .string()
            .describe("The group this query belongs to e.g. `1. discovery`"),

          query: z
            .string()
            .describe(
              'The query itself e.g. `"What are the best retail platforms?"`',
            ),
          response: z
            .string()
            .describe("The complete response from the LLM to this query"),
        }),
      ),
      sentiment: z.object({
        label: z
          .enum(["positive", "negative", "neutral", "mixed"])
          .describe(
            "The overall sentiment e.g. `positive`, `negative`, `neutral`, `mixed`",
          ),
        summary: z
          .string()
          .describe(
            'A 2-3 sentence summary of the sentiment of the run e.g. `"Rentail.space is cited positively across multiple queries, frequently appearing as a top recommendation for finding short-term retail space. It ranks prominently in citations and is described as a reliable marketplace for pop-up and kiosk leasing."`',
          ),
      }),
    }),
  ),
});

export function generateOpenApiSpec(): ReturnType<typeof createDocument> {
  return createDocument({
    openapi: "3.1.0",
    info: {
      title: "cite.me.in Monitoring API",
      version: "1.0.0",
      description:
        "Monitor your brand's visibility in AI-generated responses. Authenticate with your API key from the profile page. See the [documentation](https://cite.me.in/docs) for more information.",
    },
    servers: [{ url: envVars.VITE_APP_URL }],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
        },
      },
    },

    paths: {
      "/api/me/{email}": {
        get: {
          description:
            "Gets the details of the current user. Includes all the sites they have access to. You can only use this endpoint with your own email address.",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              description: "The email address of the user to get details for",
              in: "path",
              name: "email",
              required: true,
            },
          ],
          responses: {
            200: {
              description: "User details with sites",
              content: { "application/json": { schema: UserSchema } },
            },
            401: {
              description: "Unauthorized",
            },
            404: {
              description: "Email not recognised or not found",
            },
          },
        },
      },

      "/api/sites/{domain}": {
        get: {
          description:
            "Gets the details of a site you have access to, and lists all the users who also have access to that site and their roles (owner or member).",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              description:
                "The domain of the site to get queries for e.g. `example.com`",
              in: "path",
              name: "domain",
              required: true,
            },
          ],
          responses: {
            200: {
              description: "Site details with users",
              content: { "application/json": { schema: SiteSchema } },
            },
            401: {
              description: "Unauthorized",
            },
            404: {
              description: "Domain not recognised or not found",
            },
          },
        },
      },

      "/api/sites/{domain}/metrics": {
        get: {
          description:
            "Metrics for a site provide overall citations count, your citations count, visibility score, and unique bot visits. Each metric has one value for the current week and one for the previous week.",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              description:
                "The domain of the site to get metrics for e.g. `example.com`",
              in: "path",
              name: "domain",
              required: true,
            },
          ],
          responses: {
            200: {
              description: "Queries for the site",
              content: { "application/json": { schema: SiteMetricsSchema } },
            },
            401: {
              description: "Unauthorized",
            },
            404: {
              description: "Domain not recognised or not found",
            },
          },
        },
      },
      "/api/sites/{domain}/queries": {
        get: {
          description:
            "Gets the queries for a site and for each query, the citations found. The queries are sorted by the date they were run in descending order, with the most recent queries first.\n\nFor each platform list all query runs for that platform, including the query, the citations found, and the sentiment from that platform. Also the overall sentiment from that platform.",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              description:
                "The domain of the site to get queries for e.g. `example.com`",
              in: "path",
              name: "domain",
              required: true,
            },
          ],
          responses: {
            200: {
              description: "Queries for the site",
              content: { "application/json": { schema: SiteQueriesSchema } },
            },
            401: {
              description: "Unauthorized",
            },
            404: {
              description: "Domain not recognised or not found",
            },
          },
        },
      },
    },
  });
}
