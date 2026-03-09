import { format } from "node:util";

const ignore = [
  // React hydration warnings from Playwright interactions
  "A tree hydrated but some attributes",
  "hydration mismatch",
  // Vite HMR manifest patch failures (dev server interruptions)
  "Failed to fetch manifest patches",
  "fetchAndApplyManifestPatches",
  // Vite optimize dep warnings (dev server interruptions)
  "status of 504 (Outdated Optimize Dep)",
  // React DevTools warnings
  "Download the React DevTools",
  // Browser network errors
  "Failed to load resource",
  "blocking stylesheet: fonts.googleapis.com",
  // Recharts warning when chart container has no computed size in headless browser
  "The width(-1) and height(-1) of chart should be greater than 0",
  "[vite] connecting...",
  "[vite] connected.",
];

/**
 * Suppress expected browser warnings in tests - these don't affect functionality
 */
const originalConsoleError = console.error;
const trimConsole = (...args: unknown[]) => {
  const message = format(...args);
  if (ignore.find((ignoredMessage) => message.includes(ignoredMessage))) return;
  originalConsoleError(...args);
};
console.error = trimConsole;

export default trimConsole;
