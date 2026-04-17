import { ms } from "convert";
import debug from "debug";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { URL as URLString } from "node:url";
import {
  type BrowserContext,
  type Page,
  type Route,
  chromium,
} from "playwright";
import trimConsole from "./trimConsole";

export const port = 9222;

let context: BrowserContext | undefined;
const logger = debug("browser");

/**
 * Open a new page in the browser. This function will reload the page to ensure
 * that the page is fully loaded.
 *
 * @param path - The path to open.
 * @param headers - The headers to set on the page (optional).
 * @returns The page.
 */
export async function goto(path: string, headers?: HeadersInit): Promise<Page> {
  const context = await newContext();
  const page = await context.newPage();
  await page.setExtraHTTPHeaders(Object.fromEntries(new Headers(headers)));
  await page.goto(path, { timeout: ms("30s") });

  // NOTE: We need to reload the page otherwise React doesn't handle the form
  // submission correctly on Playwright.
  await page.reload({ waitUntil: "load" });
  await page.waitForFunction(
    () => document.body.getAttribute("data-hydrated") === "true",
    {
      timeout: ms("15s"),
    },
  );

  return page;
}

/**
 * Create a new browser context.
 *
 * @returns The browser context.
 */
export async function newContext(): Promise<BrowserContext> {
  if (context) return context;

  const headless = process.env.CI ? true : !logger.enabled;
  const browser = await chromium.launch({
    headless,
    slowMo: process.env.SLOW_MO ? Number(process.env.SLOW_MO) : undefined,
  });

  context = await browser.newContext({
    baseURL: `http://localhost:${port}`,
    viewport: { width: 1024, height: 780 },
  });
  context.setGeolocation({ latitude: 33.74901, longitude: -118.1956 });
  context.route("**", blockOutgoingRequests);
  context
    .on("console", (msg) => trimConsole(msg.text()))
    .on("weberror", (error) => logger("error: %s", error.error()));

  // Set navigation timeout to 5s less than hook timeout for better error messages
  context.setDefaultNavigationTimeout(ms("10s"));
  // Ensure the __screenshots__ directory exists
  await mkdir(resolve("__screenshots__"), { recursive: true });

  return context;
}

async function blockOutgoingRequests(route: Route): Promise<void> {
  const { hostname } = new URLString(route.request().url());

  // Allow local requests to pass through
  if (hostname === "localhost" || hostname === "127.0.0.1")
    return await route.continue();

  // Abort non-local requests to prevent cookie handling interference
  // (Playwright waits for all requests before completing navigation)
  const resourceType = route.request().resourceType();
  logger("blocking %s: %s", resourceType, hostname);
  await route.abort();
}

function cleanup() {
  context?.browser()?.close();
}

process.on("exit", cleanup);
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
