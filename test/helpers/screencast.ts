import { existsSync } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import "playwright";
import type { Page, ScreencastOptions } from "playwright";

declare module "playwright" {
  interface ScreencastOptions {
    path?: string;
    size?: { width: number; height: number };
  }

  interface Screencast {
    start(options?: ScreencastOptions): Promise<void>;
    stop(): Promise<void>;
  }

  interface Page {
    screencast: Screencast;
  }
}

/**
 * Start a screencast.
 *
 * @param page - The page to record.
 * @param name - The name of the screencast.
 * @param options - The options for the screencast.
 * @returns The filename of the screencast.
 */
export async function startScreencast(page: Page, name: string, options?: ScreencastOptions) {
  const filename = join(process.cwd(), "__screenshots__", `${name}.webm`);
  await mkdir(dirname(filename), { recursive: true });
  if (existsSync(filename)) await unlink(filename);

  if (options?.size)
    await page.setViewportSize({
      width: options.size.width,
      height: options.size.height,
    });
  await page.screencast.start({ path: filename, ...options });
  return filename;
}

/**
 * Stop a screencast.
 *
 * @param page - The page to stop the screencast on.
 */
export async function stopScreencast(page: Page) {
  await page.screencast.stop();
  await page.close();
}
