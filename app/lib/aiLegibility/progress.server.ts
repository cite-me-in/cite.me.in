import { convert } from "convert";
import debug from "debug";
import Redis from "ioredis";
import invariant from "tiny-invariant";
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
}): Promise<ScanProgress | null> {
  const redis = getRedis();
  const lines = await redis.lrange(logKey(domain), offset, -1);
  const status = await redis.get(statusKey(domain));

  switch (status) {
    case "running":
      return { lines, done: false, nextOffset: offset + lines.length };
    case "complete": {
      const resultJson = await redis.get(resultKey(domain));
      invariant(resultJson, "Result not found");
      const result = JSON.parse(resultJson) as ScanResult;
      return { lines, done: true, nextOffset: offset + lines.length, result };
    }
    case "error":
      return { lines, done: true, nextOffset: offset + lines.length };
  }

  return { lines, done: true, nextOffset: offset + lines.length };
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
