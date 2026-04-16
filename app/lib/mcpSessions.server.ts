import debug from "debug";
import Redis from "ioredis";
import envVars from "./envVars.server";

const logger = debug("mcp:sessions");
const SESSION_TTL = 3600; // 1 hour
const PREFIX = "mcp:session";

interface SessionData {
  userId: string;
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

function sessionKey(sessionId: string): string {
  return `${PREFIX}:${sessionId}`;
}

/**
 * Creates a session for the user and store in Redis so it persists across
 * restarts. This is essential since client expects MCP sessions to persist
 * while server restarts frequently.
 *
 * @param sessionId - The session ID
 * @param userId - The user ID
 */
export async function createSession({
  sessionId,
  userId,
}: {
  sessionId: string;
  userId: string;
}): Promise<void> {
  const data: SessionData = { userId };
  await getRedis().set(
    sessionKey(sessionId),
    JSON.stringify(data),
    "EX",
    SESSION_TTL,
  );
}

/**
 * Get a session from Redis. If the session exists, refresh the TTL so it
 * persists longer.
 *
 * @param sessionId - The session ID
 * @returns The session data or null if the session does not exist
 */
export async function getSession(
  sessionId: string,
): Promise<SessionData | null> {
  const data = await getRedis().get(sessionKey(sessionId));
  if (!data) return null;

  try {
    await getRedis().expire(sessionKey(sessionId), SESSION_TTL);
    return JSON.parse(data) as SessionData;
  } catch {
    return null;
  }
}

/**
 * Delete a session from Redis.
 *
 * @param sessionId - The session ID
 */
export async function deleteSession(sessionId: string): Promise<void> {
  await getRedis().del(sessionKey(sessionId));
}
