#!/usr/bin/env npx tsx

/**
 * Run this when you want to review new screenshots.
 *
 * Usage:
 *   npx tsx scripts/screenshots.ts
 */

import { execSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  readdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";

const screenshotsDir = resolve(import.meta.dirname, "..", "__screenshots__");

function findNewScreenshots(): string[] {
  const results: string[] = [];
  function scan(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        scan(path);
      } else if (entry.name.endsWith(".new.png")) {
        results.push(path);
      }
    }
  }
  if (existsSync(screenshotsDir)) scan(screenshotsDir);
  return results;
}

const newScreenshots = findNewScreenshots();

if (newScreenshots.length === 0) {
  console.info("No new screenshots to review.");
  process.exit(0);
}

console.info(`Found ${newScreenshots.length} new screenshot(s) to review.`);

const htmlPath = join(screenshotsDir, "review.html");

const items = newScreenshots.map((p) => ({
  name: p
    .replace(screenshotsDir, "")
    .replace(/^\//, "")
    .replace(".new.png", ""),
  newPath: p.replace(screenshotsDir, ""),
  oldPath: p.replace(".new.png", ".png").replace(screenshotsDir, ""),
}));

const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Screenshot Review</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #1a1a1a; color: #fff; padding: 20px; }
    h1 { margin-bottom: 20px; font-size: 24px; }
    .item { margin-bottom: 40px; border: 1px solid #333; border-radius: 8px; overflow: hidden; }
    .item-header { padding: 12px 16px; background: #252525; display: flex; justify-content: space-between; align-items: center; }
    .item-name { font-family: monospace; font-size: 14px; }
    .item-actions { display: flex; gap: 8px; }
    button { padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500; }
    .accept { background: #22c55e; color: #000; }
    .accept:hover { background: #16a34a; }
    .skip { background: #6b7280; color: #fff; }
    .skip:hover { background: #4b5563; }
    .images { display: flex; gap: 20px; padding: 20px; background: #0a0a0a; }
    .image-panel { flex: 1; }
    .image-panel h3 { margin-bottom: 12px; font-size: 14px; color: #888; }
    .image-panel img { max-width: 100%; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
    .done { text-align: center; padding: 60px; font-size: 18px; color: #888; }
    .hint { position: fixed; bottom: 20px; right: 20px; background: #333; padding: 12px 16px; border-radius: 8px; font-size: 13px; color: #888; }
    kbd { background: #555; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
  </style>
</head>
<body>
  <h1>Screenshot Review</h1>
  <div id="items"></div>
  <div class="hint">Press <kbd>A</kbd> to accept, <kbd>S</kbd> to skip, <kbd>Esc</kbd> to close</div>
  <script>
    const items = ${JSON.stringify(items)};
    let currentIndex = 0;
    const container = document.getElementById("items");
    function render() {
      if (currentIndex >= items.length) {
        container.innerHTML = '<div class="done">All screenshots reviewed! You can close this window.</div>';
        return;
      }
      const item = items[currentIndex];
      container.innerHTML = \`
        <div class="item" data-index="\${currentIndex}">
          <div class="item-header">
            <span class="item-name">\${item.name}</span>
            <div class="item-actions">
              <button class="skip" onclick="skip()">Skip (S)</button>
              <button class="accept" onclick="accept()">Accept (A)</button>
            </div>
          </div>
          <div class="images">
            <div class="image-panel">
              <h3>Original</h3>
              <img src="\${item.oldPath}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22><rect fill=%22%23333%22 width=%22400%22 height=%22300%22/><text x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%23666%22 font-family=%22sans-serif%22>Not found</text></svg>'">
            </div>
            <div class="image-panel">
              <h3>New</h3>
              <img src="\${item.newPath}">
            </div>
          </div>
        </div>
      \`;
      document.querySelector('.accept')?.focus();
    }
    async function accept() {
      const item = items[currentIndex];
      await fetch("/accept?path=" + encodeURIComponent(item.newPath));
      currentIndex++;
      render();
    }
    function skip() {
      currentIndex++;
      render();
    }
    document.addEventListener("keydown", (e) => {
      if (e.key === "a" || e.key === "A") accept();
      else if (e.key === "s" || e.key === "S") skip();
      else if (e.key === "Escape") window.close();
    });
    render();
  </script>
</body>
</html>`;

writeFileSync(htmlPath, html);

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");

  if (url.pathname === "/accept") {
    const relPath = url.searchParams.get("path");
    if (relPath) {
      const newPath = join(screenshotsDir, relPath);
      if (existsSync(newPath)) {
        const oldPath = newPath.replace(".new.png", ".png");
        const diffPath = newPath.replace(".new.png", ".diff.png");
        const newHtmlPath = newPath.replace(".new.png", ".new.html");
        const oldHtmlPath = newPath.replace(".new.png", ".html");
        const diffHtmlPath = newPath.replace(".new.png", ".html.diff");

        if (existsSync(oldPath)) unlinkSync(oldPath);
        renameSync(newPath, oldPath);
        if (existsSync(diffPath)) unlinkSync(diffPath);
        if (existsSync(newHtmlPath)) {
          if (existsSync(oldHtmlPath)) unlinkSync(oldHtmlPath);
          renameSync(newHtmlPath, oldHtmlPath);
        }
        if (existsSync(diffHtmlPath)) unlinkSync(diffHtmlPath);

        console.info(`Accepted: ${relPath.replace(".new.png", "")}`);
      }
    }
    res.writeHead(200);
    res.end("ok");
    return;
  }

  const filePath = join(screenshotsDir, url.pathname);
  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const ext = extname(filePath);
  const mimeTypes: Record<string, string> = {
    ".html": "text/html",
    ".png": "image/png",
    ".css": "text/css",
    ".js": "application/javascript",
  };

  res.writeHead(200, {
    "Content-Type": mimeTypes[ext] || "application/octet-stream",
  });
  res.end(readFileSync(filePath));
});

const port = 3456;
server.listen(port, () => {
  console.info(`Opening http://localhost:${port}/review.html`);
  execSync(`open http://localhost:${port}/review.html`);
});

process.on("SIGINT", () => {
  server.close();
  if (existsSync(htmlPath)) unlinkSync(htmlPath);
  console.info("\nDone.");
  process.exit(0);
});
