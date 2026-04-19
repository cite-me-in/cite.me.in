import { convert } from "convert";
import debug from "debug";
import Redis from "ioredis";
import captureAndLogError from "~/lib/captureAndLogError.server";
import envVars from "~/lib/envVars.server";
import type { ScanProgress, ScanResult } from "./types";

const logger = debug("ai-legibility:redis");
const TTL = convert(24, "hours").to("seconds");

export async function appendLog({
  line,
  scanId,
}: {
  line: string;
  scanId: string;
}): Promise<number> {
  return await getRedis().rpush(logKey(scanId), line);
}

export async function setStatus({
  scanId,
  status,
}: {
  scanId: string;
  status: "running" | "complete" | "error";
}) {
  const redis = getRedis();
  await redis.set(statusKey(scanId), status, "EX", TTL);
  await redis.expire(logKey(scanId), TTL);
}

export async function setResult({
  result,
  scanId,
}: {
  result: ScanResult;
  scanId: string;
}) {
  const redis = getRedis();
  await redis.set(resultKey(scanId), JSON.stringify(result), "EX", TTL);
}

export async function getProgress({
  offset,
  scanId,
}: {
  offset: number;
  scanId: string;
}): Promise<ScanProgress> {
  const redis = getRedis();
  const lines = await redis.lrange(logKey(scanId), offset, -1);
  const status = await redis.get(statusKey(scanId));
  const done = status === "complete" || status === "error";

  let result: ScanResult | undefined;
  if (done) {
    const resultJson = await redis.get(resultKey(scanId));
    if (resultJson) {
      try {
        result = JSON.parse(resultJson) as ScanResult;
      } catch {
        logger("Failed to parse result JSON for scan %s", scanId);
      }
    }
  }

  return { lines, done, nextOffset: offset + lines.length, result };
}

export async function getStatus({
  scanId,
}: {
  scanId: string;
}): Promise<"running" | "complete" | "error" | null> {
  try {
    const status = await getRedis().get(statusKey(scanId));
    return status as "running" | "complete" | "error" | null;
  } catch (error) {
    captureAndLogError(error, { extra: { scanId } });
    return null;
  }
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

function logKey(scanId: string) {
  return `ai-legibility:${scanId}:log`;
}

function statusKey(scanId: string) {
  return `ai-legibility:${scanId}:status`;
}

function resultKey(scanId: string) {
  return `ai-legibility:${scanId}:result`;
}
