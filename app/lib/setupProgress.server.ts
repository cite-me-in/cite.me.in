import debug from "debug";
import Redis from "ioredis";
import captureAndLogError from "./captureAndLogError.server";
import envVars from "./envVars.server";

const logger = debug("setup:redis");
const TTL = 86_400; // 24 hours

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
}): Promise<number> {
  return await getRedis().rpush(logKey(siteId, userId), line);
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
  const redis = getRedis();
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
  const redis = getRedis();
  const lines = await redis.lrange(logKey(siteId, userId), offset, -1);
  const status = await redis.get(statusKey(siteId, userId));
  const done = status === "complete" || status === "error";
  return { lines, done, nextOffset: offset + lines.length };
}

/**
 * Gets the status for the given site and user.
 *
 * @param siteId - The ID of the site
 * @param userId - The ID of the user
 * @returns The status for the given site and user. Returns `null` if the status is not set.
 */
export async function getStatus({
  siteId,
  userId,
}: {
  siteId: string;
  userId: string;
}): Promise<"running" | "complete" | "error" | null> {
  try {
    const status = await getRedis().get(statusKey(siteId, userId));
    return status as "running" | "complete" | "error" | null;
  } catch (error) {
    captureAndLogError(error, { extra: { siteId, userId } });
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

/**
 * Key for logging progress for a given site and user. The log is a list of
 * strings, one for each line.
 *
 * @param siteId - The ID of the site
 * @param userId - The ID of the user
 * @returns The key for the log. Expires in 24 hours.
 */
function logKey(siteId: string, userId: string) {
  return `setup:${siteId}:${userId}:log`;
}

/**
 * Key for the status of a given site and user. The status is a string that is
 * either `running`, `complete`, or `error`.
 *
 * @param siteId - The ID of the site
 * @param userId - The ID of the user
 * @returns The key for the status. Expires in 24 hours.
 */
function statusKey(siteId: string, userId: string) {
  return `setup:${siteId}:${userId}:status`;
}
