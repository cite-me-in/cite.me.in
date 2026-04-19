import debug from "debug";
import Redis from "ioredis";
import envVars from "./envVars.server";

const logger = debug("ratelimit");

function getRedis(): Redis {
  const redis = new Redis(envVars.REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
    lazyConnect: true,
  });
  redis.on("error", (err) => logger("Redis error: %O", err));
  return redis;
}

function key(userId: string): string {
  const minute = Math.floor(Date.now() / 60000);
  return `ratelimit:${userId}:${minute}`;
}

/**
 * Check the rate limit for a user. If the user exceeds the rate limit, then
 * allowed is false.  Othewise, remaining is the number of requests remaining
 * and resetAt is the timestamp when the rate limit will next reset in
 * milliseconds.
 *
 * @param identity - The identity to use for the rate limit
 * @param maxRequests - The maximum number of requests allowed
 * @param windowSeconds - The number of seconds in the rate limit window
 * @returns allowed - true if the user is within the rate limit, false otherwise
 * @returns remaining - the number of requests remaining in the current window
 * @returns resetAt - the timestamp when the rate limit will next reset in milliseconds
 */
export async function checkRateLimit({
  identity,
  maxRequests,
  windowSeconds,
}: {
  identity: string;
  maxRequests: number;
  windowSeconds: number;
}): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: number;
}> {
  const redis = getRedis();
  const uniqueKey = key(identity);

  const count = await redis.incr(uniqueKey);
  if (count === 1) await redis.expire(uniqueKey, windowSeconds);

  const ttl = await redis.ttl(uniqueKey);
  const resetAt = Date.now() + ttl * 1000;

  const allowed = count <= maxRequests;
  const remaining = Math.max(0, maxRequests - count);

  if (!allowed) {
    logger("Rate limit exceeded for user %s: %d/%d", key, count, maxRequests);
  }

  return { allowed, remaining, resetAt };
}

/**
 * Reset the rate limit for a user. Used for testing.
 *
 * @param userId - The user ID
 */
export async function resetRateLimit(userId: string): Promise<void> {
  await getRedis().del(key(userId));
}
