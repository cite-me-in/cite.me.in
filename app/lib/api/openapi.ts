import { z } from "zod";
import { createDocument } from "zod-openapi";

export const UserSchema = z.object({
  id: z.string().describe("The ID of the user"),
  email: z.email().describe("The email address of the user"),
  plan: z
    .enum(["trial", "paid", "gratis", "cancelled"])
    .describe(
      "The plan of the user e.g. `trial`, `paid`, `gratis`, `cancelled`",
    ),
  sites: z.array(
    z.object({
      domain: z.string().describe("The domain of the site e.g. `example.com`"),
      summary: z
        .string()
        .describe("The summary of the site e.g. `This product is fantastic`"),
      createdAt: z.iso
        .date()
        .describe("The date the site was created e.g. `2024-01-01`"),
    }),
  ),
});

export const SiteSchema = z.object({
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
        id: z.string().describe("The ID of the user"),
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
    previous: z.number().describe("Total citations for the previous week"),
  }),
  yourCitations: z.object({
    current: z.number().describe("Your citations only for the current week"),
    previous: z.number().describe("Your citations only for the previous week"),
  }),
  visbilityScore: z.object({
    current: z.number().describe("LLM visibility score for the current week"),
    previous: z.number().describe("LLM visibility score for the previous week"),
  }),
  queryCoverageRate: z.object({
    current: z
      .number()
      .describe(
        "Percentage of queries where domain appears in citations for the current week (0-100)",
      ),
    previous: z
      .number()
      .describe(
        "Percentage of queries where domain appears in citations for the previous week (0-100)",
      ),
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
            .array(
              z.object({
                url: z.url().describe("The citation URL"),
                relationship: z
                  .enum(["direct", "indirect", "unrelated"])
                  .optional()
                  .describe(
                    "Classification: direct=your domain, indirect=related content, unrelated=not relevant",
                  ),
                reason: z
                  .string()
                  .optional()
                  .describe("Explanation of the classification"),
              }),
            )
            .describe(
              "The citations in the query response with classification",
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
      description: `Monitor your brand's visibility in AI-generated responses. Authenticate with your API key from the profile page. See the [documentation](${new URL(
        "/docs",
        import.meta.env.VITE_APP_URL,
      )}) for more information.`,
    },
    servers: [{ url: import.meta.env.VITE_APP_URL as string }],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
        },
      },
    },

    paths: {
      "/api/me": {
        get: {
          description:
            "Responds with the details of the authenticated user. Includes all the sites they have access to.",
          security: [{ BearerAuth: [] }],
          responses: {
            200: {
              description: "User details with sites",
              content: { "application/json": { schema: UserSchema } },
            },
            401: {
              description: "Unauthorized",
            },
            404: {
              description: "User not found",
            },
          },
        },
      },

      "/api/user/{id}": {
        get: {
          description:
            "Responds with the details of the given user. Includes all the sites they have access to. You can only use this endpoint with your own user ID.",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              description:
                "The ID of the user to get details for e.g. `clxyz123abc`",
              in: "path",
              name: "id",
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
              description: "User not found",
            },
          },
        },
      },

      "/api/site/{domain}": {
        get: {
          description:
            "Responds with the details of the given site. Includes the content of the site, the summary, the date the site was added, and the users who have access to that site and their roles (owner or member).",
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

      "/api/site/{domain}/metrics": {
        get: {
          description:
            "Responds with the metrics for the given site. Overall citations, your citations, visibility score, and query coverage rate. For each metric includes value for the current week and for the previous week.",
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
      "/api/site/{domain}/queries": {
        get: {
          description:
            "Responds with the queries for the given site. For each platform list all the queries run against that platform, the citations found, and the platform sentiment.",
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
