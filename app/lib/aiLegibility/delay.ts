import { sleep } from "radashi";

const MIN_DELAY = 500;
const MAX_DELAY = 1500;

/**
 * Make sure each check takes at least MIN_DELAY (500ms) and at most MAX_DELAY
 * (1500ms) milliseconds. For example, if `checkMetaTags` takes 2sec, then this
 * step would take 2sec. If `checkRobotsTxt` takes 300ms, then this step would
 * take 500ms to 1.5sec. The delay is random.
 *
 * @param fn - The function to execute
 * @returns The result of the function
 */
export async function withMinDelay<T>(fn: () => Promise<T>): Promise<T> {
  // NOTE No delay when running tests
  if (process.env.NODE_ENV === "test") return fn();

  const startTime = Date.now();
  try {
    return await fn();
  } finally {
    const elapsed = Date.now() - startTime;
    const minDuration = MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY);

    if (elapsed < minDuration) await sleep(minDuration - elapsed);
  }
}
