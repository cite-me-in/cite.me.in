import { convert } from "convert";
import Redis from "ioredis";
import { runScanSteps } from "~/lib/aiLegibility/runAILegibilityScan";
import type { ScanResult } from "~/lib/aiLegibility/types";
import { getDomainMeta } from "~/lib/domainMeta.server";
import envVars from "./envVars.server";

const TTL = convert(5, "minutes").to("seconds");

function getRedis(): Redis {
  const redis = new Redis(envVars.REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
    lazyConnect: true,
  });
  redis.on("error", () => {});
  return redis;
}

function logKey(domain: string) {
  return `ai-legibility:${domain}:log`;
}

function statusKey(domain: string) {
  return `ai-legibility:${domain}:status`;
}

function resultKey(domain: string) {
  return `ai-legibility:${domain}:result`;
}

function errorKey(domain: string) {
  return `ai-legibility:${domain}:error`;
}

export async function getScanStatus(domain: string) {
  const redis = getRedis();
  const [rawStatus, lines, rawResult, rawError] = await Promise.all([
    redis.get(statusKey(domain)),
    redis.lrange(logKey(domain), 0, -1),
    redis.get(resultKey(domain)),
    redis.get(errorKey(domain)),
  ]);
  redis.disconnect();

  if (!rawStatus) return null;

  let result: ScanResult | undefined;
  if (rawStatus === "complete" && rawResult) {
    result = JSON.parse(rawResult) as ScanResult;
  }

  return {
    lines: lines ?? [],
    status: rawStatus,
    result,
    error: rawError ?? null,
  };
}

export async function startScan(domain: string) {
  const lower = domain.toLowerCase();

  const redis = getRedis();
  const currentStatus = await redis.get(statusKey(lower));
  redis.disconnect();

  if (currentStatus === "running") return;

  const now = getRedis();
  await now.del(logKey(lower));
  await now.del(resultKey(lower));
  await now.del(errorKey(lower));
  await now.setex(statusKey(lower), TTL, "running");
  now.disconnect();

  runScan(domain).catch(() => {});
}

async function log(domain: string, line: string) {
  const redis = getRedis();
  await redis.rpush(logKey(domain), line);
  await redis.expire(logKey(domain), TTL);
  redis.disconnect();
}

async function runScan(domain: string) {
  const lower = domain.toLowerCase();

  try {
    await log(lower, `Looking up ${domain}...`);
    const meta = await getDomainMeta(domain);
    await log(lower, `Found site: ${meta.brandName}`);

    await log(lower, "Running AI legibility check...");
    const result = await runScanSteps({
      log: (line: string) => log(lower, line),
      domain,
    });

    const passed = result.checks.filter((c) => c.passed).length;
    const total = result.checks.length;

    await log(lower, `${passed}/${total} checks passed`);

    const redis = getRedis();
    await redis.setex(resultKey(lower), TTL, JSON.stringify(result));
    await redis.setex(statusKey(lower), TTL, "complete");
    redis.disconnect();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Scan failed. Try again.";
    const redis = getRedis();
    await redis.setex(errorKey(lower), TTL, message);
    await redis.setex(statusKey(lower), TTL, "error");
    redis.disconnect();
  }
}
