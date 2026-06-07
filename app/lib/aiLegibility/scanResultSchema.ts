import { z } from "zod";

import { CHECK_CATEGORIES, CHECK_EFFORT_LEVELS } from "./types";

const CheckResultSchema = z.object({
  name: z.string(),
  category: z.enum(CHECK_CATEGORIES),
  passed: z.boolean(),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
  timedOut: z.boolean().optional(),
  detail: z
    .object({
      goal: z.string(),
      issue: z.string(),
      howToImplement: z.string(),
      fixExample: z.string().optional(),
      effort: z.enum(CHECK_EFFORT_LEVELS),
      resourceLinks: z.array(z.object({ label: z.string(), url: z.string() })),
      skillURL: z.string().optional(),
    })
    .optional(),
});

const SuggestionSchema = z.object({
  title: z.string(),
  description: z.string(),
  effort: z.string(),
  resourceLinks: z.array(z.object({ label: z.string(), url: z.string() })),
});

export const ScanResultSchema = z.object({
  url: z.string(),
  scannedAt: z.string(),
  checks: z.array(CheckResultSchema).optional(),
  suggestions: z.array(SuggestionSchema).optional(),
  summary: z.object({
    discovered: z.object({ passed: z.number(), total: z.number() }),
    trusted: z.object({ passed: z.number(), total: z.number() }),
    welcomed: z.object({ passed: z.number(), total: z.number() }),
  }),
});
