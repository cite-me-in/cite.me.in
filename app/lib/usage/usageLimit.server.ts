import envVars from "~/lib/envVars.server";
import {
  MODEL_ID as CLAUDE_MODEL_ID,
  MODEL_PRICING as CLAUDE_PRICING,
} from "~/lib/llm-visibility/claudeClient.server";
import {
  MODEL_ID as GEMINI_MODEL_ID,
  MODEL_PRICING as GEMINI_PRICING,
} from "~/lib/llm-visibility/geminiClient";
import {
  MODEL_ID as OPENAI_MODEL_ID,
  MODEL_PRICING as OPENAI_PRICING,
} from "~/lib/llm-visibility/openaiClient";
import {
  MODEL_ID as PERPLEXITY_MODEL_ID,
  MODEL_PRICING as PERPLEXITY_PRICING,
} from "~/lib/llm-visibility/perplexityClient";
import prisma from "~/lib/prisma.server";
import { Prisma } from "~/prisma";
import logError from "../logError.server";
import { UsageLimitExceededError } from "./UsageLimitExceededError";

export async function recordUsageEvent({
  siteId,
  model,
  inputTokens,
  outputTokens,
}: {
  siteId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}): Promise<void> {
  const cost = new Prisma.Decimal(
    calculateCostUSD(model, inputTokens, outputTokens),
  );
  await prisma.usageEvent.create({
    data: { siteId, cost, inputTokens, model, outputTokens },
  });
}

export async function checkUsageLimits(siteId: string): Promise<void> {
  const baseRequests = envVars.USAGE_LIMIT_REQUESTS ?? 0;
  const requestLimits = {
    hourly: baseRequests,
    daily: baseRequests * 2,
    monthly: baseRequests * 5,
  };

  const costLimits = {
    hourly: envVars.USAGE_LIMIT_COST_USD_HOURLY ?? 0,
    daily: envVars.USAGE_LIMIT_COST_USD_DAILY ?? 0,
    monthly: envVars.USAGE_LIMIT_COST_USD_MONTHLY ?? 0,
  };

  const hasAnyCostLimit = Object.values(costLimits).some((v) => v != null);
  if (!requestLimits && !hasAnyCostLimit) return;

  const now = new Date();
  const timeWindows = [
    {
      key: "hourly" as const,
      since: new Date(now.getTime() - 60 * 60 * 1000),
    },
    {
      key: "daily" as const,
      since: new Date(now.getTime() - 24 * 60 * 60 * 1000),
    },
    {
      key: "monthly" as const,
      since: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    },
  ];

  await Promise.all(
    timeWindows.map(async ({ key, since }) => {
      const { _sum, _count } = await prisma.usageEvent.aggregate({
        where: { siteId, createdAt: { gte: since } },
        _sum: { cost: true },
        _count: { id: true },
      });

      const costLimit = costLimits[key];
      const totalCost = Number(_sum.cost ?? 0);
      if (costLimit && totalCost > costLimit)
        throw new UsageLimitExceededError({
          current: totalCost,
          limit: costLimit,
          timeWindow: key,
        });

      const totalRequests = _count.id;
      const reqLimit = requestLimits[key];
      if (reqLimit && totalRequests > reqLimit)
        throw new UsageLimitExceededError({
          current: totalRequests,
          limit: reqLimit,
          timeWindow: `${key} requests`,
        });
    }),
  );
}

function calculateCostUSD(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const cost = {
    [CLAUDE_MODEL_ID]: CLAUDE_PRICING,
    [OPENAI_MODEL_ID]: OPENAI_PRICING,
    [GEMINI_MODEL_ID]: GEMINI_PRICING,
    [PERPLEXITY_MODEL_ID]: PERPLEXITY_PRICING,
  }[model];
  if (!cost) {
    logError(`Unknown usage cost for ${model}`);
    return 0;
  }
  return "perRequest" in cost
    ? Number(cost.perRequest)
    : (inputTokens / 1_000_000) * cost.costPerInputM +
        (outputTokens / 1_000_000) * cost.costPerOutputM;
}
