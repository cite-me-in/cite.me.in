import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { URL as URLString } from "node:url";
import { ms } from "convert";
import debug from "debug";
import { type Browser, type BrowserContext, type Page, type Route, chromium } from "playwright";
import { port } from "./launchServer";
import trimConsole from "./trimConsole";

let browser: Browser | undefined;
const logger = debug("browser");

async function getBrowser(): Promise<Browser> {
  if (browser) return browser;

  const headless = process.env.CI ? true : !logger.enabled;
  browser = await chromium.launch({
    headless,
    slowMo: process.env.SLOW_MO ? Number(process.env.SLOW_MO) : undefined,
    ...(process.env.CI && {
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    }),
  });
  return browser;
}

/**
 * Open a new page in the browser. This function will reload the page to ensure
 * that the page is fully loaded.
 *
 * @param path - The path to open.
 * @param context - An optional browser context. If not provided, a new one is created.
 * @param headers - The headers to set on the page (optional).
 * @returns The page.
 */
export async function goto(
  path: string,
  context?: BrowserContext,
  headers?: HeadersInit,
): Promise<Page> {
  const ctx = context ?? (await newContext());
  const page = await ctx.newPage();
  await page.setExtraHTTPHeaders(Object.fromEntries(new Headers(headers)));
  await page.goto(path, { timeout: ms("10s") });

  // NOTE: We need to reload the page otherwise React doesn't handle the form
  // submission correctly on Playwright.
  await page.reload({ waitUntil: "load" });
  await page.waitForFunction(() => document.body.getAttribute("data-hydrated") === "true", {
    timeout: ms("8s"),
  });

  return page;
}

/**
 * Create a new browser context.
 *
 * @returns The browser context.
 */
export async function newContext(): Promise<BrowserContext> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    baseURL: `http://localhost:${port}`,
    viewport: { width: 1024, height: 780 },
  });

  await context.setGeolocation({ latitude: 33.74901, longitude: -118.1956 });
  await context.route("**", blockOutgoingRequests);
  context
    .on("console", (msg) => {
      if (
        [
          "Download the React DevTools",
          "Failed to load resource",
          "The width(-1) and height(-1) of chart",
        ].includes(msg.text())
      )
        return;
      if (msg.text().startsWith("Successfully preconnected to")) return;
      if (msg.text().includes("was preloaded using link preload")) return;

      trimConsole(msg.text());
    })
    .on("weberror", (error) => logger("error: %s", error.error()));

  // Set navigation timeout to 5s less than hook timeout for better error messages
  context.setDefaultNavigationTimeout(ms("8s"));
  // Ensure the __screenshots__ directory exists
  await mkdir(resolve("__screenshots__"), { recursive: true });

  return context;
}

async function blockOutgoingRequests(route: Route): Promise<void> {
  const { hostname } = new URLString(route.request().url());

  // Allow local requests to pass through
  if (
    ["document", "script", "xhr", "fetch", "image"].includes(route.request().resourceType()) &&
    ["localhost", "cite.me.in"].includes(hostname)
  ) {
    return await route.continue({
      url: new URL(route.request().url(), `http://localhost:${port}`).toString(),
    });
  } else {
    const resourceType = route.request().resourceType();
    logger("blocking %s: %s", resourceType, hostname);
    return route.abort();
  }
}

function cleanup() {
  void browser?.close();
}

process.on("exit", cleanup);
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
