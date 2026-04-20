import { convert } from "convert";
import debug from "debug";
import Redis from "ioredis";
import envVars from "~/lib/envVars.server";
import type { ScanProgress, ScanResult } from "./types";

const logger = debug("ai-legibility:redis");
const TTL = convert(24, "hours").to("seconds");

export async function appendLog({
  line,
  domain,
}: {
  line: string;
  domain: string;
}): Promise<number> {
  return await getRedis().rpush(logKey(domain), line);
}

export async function startNewScan({
  domain,
}: {
  domain: string;
}): Promise<void> {
  const redis = getRedis();
  await redis.del(logKey(domain));
  await redis.del(resultKey(domain));
  await redis.set(statusKey(domain), "running", "EX", TTL);
}

export async function setStatus({
  domain,
  status,
}: {
  domain: string;
  status: "running" | "complete" | "error";
}) {
  const redis = getRedis();
  await redis.set(statusKey(domain), status, "EX", TTL);
  await redis.expire(logKey(domain), TTL);
}

export async function setResult({
  result,
  domain,
}: {
  result: ScanResult;
  domain: string;
}) {
  const redis = getRedis();
  await redis.set(resultKey(domain), JSON.stringify(result), "EX", TTL);
}

export async function getProgress({
  offset,
  domain,
}: {
  offset: number;
  domain: string;
}): Promise<ScanProgress> {
  const redis = getRedis();
  const lines = await redis.lrange(logKey(domain), offset, -1);
  const status = await redis.get(statusKey(domain));
  const done = status === "complete" || status === "error";

  let result: ScanResult | undefined;
  if (done) {
    const resultJson = await redis.get(resultKey(domain));
    if (resultJson) {
      try {
        result = JSON.parse(resultJson) as ScanResult;
      } catch {
        logger("Failed to parse result JSON for scan %s", domain);
      }
    }
  }

  return { lines, done, nextOffset: offset + lines.length, result };
}

function getRedis(): Redis {
  const redis = new Redis(envVars.REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
    lazyConnect: true,
  });
  redis.on("error", (err) => logger("Redis error: %O", err));
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
