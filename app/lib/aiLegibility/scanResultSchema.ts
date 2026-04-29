import { z } from "zod";

const CheckResultSchema = z.object({
  name: z.string(),
  category: z.enum(["discovered", "trusted", "welcomed"]),
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
      effort: z.enum(["2 min", "5 min", "15 min", "1 hour"]),
      resourceLinks: z.array(z.object({ label: z.string(), url: z.string() })),
      skillURL: z.string().optional(),
    })
    .optional(),
});

export const ScanResultSchema = z.object({
  url: z.string(),
  scannedAt: z.string(),
  checks: z.array(CheckResultSchema),
  summary: z.object({
    discovered: z.object({ passed: z.number(), total: z.number() }),
    trusted: z.object({ passed: z.number(), total: z.number() }),
    welcomed: z.object({ passed: z.number(), total: z.number() }),
  }),
});
