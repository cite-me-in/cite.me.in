// app/lib/api-schemas.ts
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);

export const SiteUserSchema = z
  .object({
    email: z.email().openapi({ example: "user@example.com" }),
    role: z.enum(["owner", "member"]).openapi({ example: "owner" }),
  })
  .openapi("SiteUser");

export const SiteSchema = z
  .object({
    content: z
      .string()
      .describe("The content of the site")
      .openapi({ example: "Test content" }),
    createdAt: z.iso.date().openapi({ example: "2024-01-01" }),
    domain: z.string().openapi({ example: "example.com" }),
    summary: z.string().openapi({ example: "Test summary" }),
    users: z.array(SiteUserSchema),
  })
  .openapi("Site");

export const UserSchema = z
  .object({
    email: z.email().openapi({ example: "user@example.com" }),
    sites: z.array(
      SiteSchema.omit({ users: true, content: true, summary: true }),
    ),
  })
  .openapi("User");

export const RunSummarySchema = z
  .object({
    id: z.string().openapi({ example: "clxyz456" }),
    platform: z.string().openapi({ example: "chatgpt" }),
    model: z.string().openapi({ example: "gpt-4o" }),
    onDate: z.iso.date().openapi({ example: "2024-01-01" }),
    queryCount: z.number().int().openapi({ example: 5 }),
    citationCount: z.number().int().openapi({ example: 12 }),
  })
  .openapi("RunSummary");

export const RunsSchema = z
  .object({ runs: z.array(RunSummarySchema) })
  .openapi("Runs");

export const QuerySchema = z
  .object({
    group: z.string().openapi({ example: "1. discovery" }),
    query: z
      .string()
      .openapi({ example: "What are the best retail platforms?" }),
    citations: z
      .array(z.string())
      .openapi({ example: ["https://example.com/page1"] }),
  })
  .openapi("Query");

export const RunDetailSchema = z
  .object({
    id: z.string().openapi({ example: "clxyz456" }),
    platform: z.string().openapi({ example: "chatgpt" }),
    model: z.string().openapi({ example: "gpt-4o" }),
    onDate: z.iso.date().openapi({ example: "2024-01-01" }),
    queries: z.array(QuerySchema),
  })
  .openapi("RunDetail");
