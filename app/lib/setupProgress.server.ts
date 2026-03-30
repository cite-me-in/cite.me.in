import Redis from "ioredis";
import debug from "debug";
import envVars from "./envVars.server";

const logger = debug("setup:redis");
const redis = new Redis(envVars.REDIS_URL);
redis.on("error", (err) => logger("Redis error: %O", err));
const TTL = 86_400; // 24 hours

function logKey(siteId: string, userId: string) {
  return `setup:${siteId}:${userId}:log`;
}

function statusKey(siteId: string, userId: string) {
  return `setup:${siteId}:${userId}:status`;
}

/**
 * Appends a line to the log for the given site and user.
 *
 * @param line - The line to append to the log
 * @param siteId - The ID of the site
 * @param userId - The ID of the user
 * @returns The number of lines in the log
 */
export async function appendLog({
  line,
  siteId,
  userId,
}: {
  line: string;
  siteId: string;
  userId: string;
}) {
  return await redis.rpush(logKey(siteId, userId), line);
}

/**
 * Sets the status for the given site and user.
 *
 * @param siteId - The ID of the site
 * @param status - The status to set
 * @param userId - The ID of the user
 */
export async function setStatus({
  siteId,
  status,
  userId,
}: {
  siteId: string;
  status: "running" | "complete" | "error";
  userId: string;
}) {
  await redis.set(statusKey(siteId, userId), status, "EX", TTL);
  await redis.expire(logKey(siteId, userId), TTL);
}

/**
 * Gets the progress for the given site and user.
 *
 * @param offset - The offset to start from
 * @param siteId - The ID of the site
 * @param userId - The ID of the user
 * @returns The progress for the given site and user
 */
export async function getProgress({
  offset,
  siteId,
  userId,
}: {
  offset: number;
  siteId: string;
  userId: string;
}): Promise<{ lines: string[]; done: boolean; nextOffset: number }> {
  const [lines, status] = await Promise.all([
    redis.lrange(logKey(siteId, userId), offset, -1),
    redis.get(statusKey(siteId, userId)),
  ]);
  const done = status === "complete" || status === "error";
  return { lines, done, nextOffset: offset + lines.length };
}

/**
 * Gets the status for the given site and user.
 *
 * @param siteId - The ID of the site
 * @param userId - The ID of the user
 * @returns The status for the given site and user
 */
export async function getStatus({
  siteId,
  userId,
}: {
  siteId: string;
  userId: string;
}) {
  return redis.get(statusKey(siteId, userId));
}
