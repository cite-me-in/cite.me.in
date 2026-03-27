import redis from "./redis.server";

const TTL = 86_400; // 24 hours

function logKey(siteId: string, userId: string) {
  return `setup:${siteId}:${userId}:log`;
}
function statusKey(siteId: string, userId: string) {
  return `setup:${siteId}:${userId}:status`;
}

export async function appendLog(siteId: string, userId: string, line: string) {
  await redis.rpush(logKey(siteId, userId), line);
}

export async function setStatus(
  siteId: string,
  userId: string,
  status: "running" | "complete" | "error",
) {
  await redis.set(statusKey(siteId, userId), status, "EX", TTL);
  await redis.expire(logKey(siteId, userId), TTL);
}

export async function getProgress(
  siteId: string,
  userId: string,
  offset: number,
): Promise<{ lines: string[]; done: boolean; nextOffset: number }> {
  const [lines, status] = await Promise.all([
    redis.lrange(logKey(siteId, userId), offset, -1),
    redis.get(statusKey(siteId, userId)),
  ]);
  const done = status === "complete" || status === "error";
  return { lines, done, nextOffset: offset + lines.length };
}

export async function getStatus(siteId: string, userId: string) {
  return redis.get(statusKey(siteId, userId));
}
