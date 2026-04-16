import debug from "debug";
import { createHash } from "node:crypto";

const logger = debug("server");

export async function checkCitedPageHealth(url: string): Promise<{
  statusCode: number | null;
  contentHash: string | null;
  isHealthy: boolean;
}> {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": "cite.me.in/1.0 (page health monitor)" },
      signal: AbortSignal.timeout(10_000),
      redirect: "follow",
    });
    const text = await response.text();
    const contentHash = createHash("sha256")
      .update(text.slice(0, 50_000))
      .digest("hex");
    const isHealthy = response.status >= 200 && response.status < 400;
    logger(
      `[citedPageHealth] ${url} => ${response.status} ${isHealthy ? "healthy" : "unhealthy"}`,
    );
    return { statusCode: response.status, contentHash, isHealthy };
  } catch {
    return { statusCode: null, contentHash: null, isHealthy: false };
  }
}
