import debug from "debug";
import Redis from "ioredis";
import envVars from "./envVars.server";

const logger = debug("ratelimit");

const DEFAULT_CONFIG = {
  maxRequests: 60,
  windowSeconds: 60,
};

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
 * @param userId - The user ID
 * @param config - The rate limit configuration
 * @returns allowed - true if the user is within the rate limit, false otherwise
 * @returns remaining - the number of requests remaining in the current window
 * @returns resetAt - the timestamp when the rate limit will next reset in milliseconds
 */
export async function checkRateLimit(
  userId: string,
  config: {
    maxRequests: number;
    windowSeconds: number;
  } = DEFAULT_CONFIG,
): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: number;
}> {
  const redis = getRedis();
  const k = key(userId);

  const count = await redis.incr(k);
  if (count === 1) await redis.expire(k, config.windowSeconds);

  const ttl = await redis.ttl(k);
  const resetAt = Date.now() + ttl * 1000;

  const allowed = count <= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - count);

  if (!allowed) {
    logger(
      "Rate limit exceeded for user %s: %d/%d",
      userId,
      count,
      config.maxRequests,
    );
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
