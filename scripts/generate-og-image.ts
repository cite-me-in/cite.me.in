#!/usr/bin/env tsx
import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @font-face {
    font-family: 'Archivo';
    src: url('file://${root}/public/fonts/Archivo-VariableFont_wdth,wght.ttf');
    font-weight: 100 900;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1200px;
    height: 630px;
    background: #111111;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Archivo', sans-serif;
  }
  .container {
    display: flex;
    align-items: center;
    gap: 64px;
  }
  .icon {
    width: 160px;
    height: 160px;
    flex-shrink: 0;
  }
  .text {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .name {
    font-size: 80px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: -2px;
    line-height: 1;
  }
  .tagline {
    font-size: 32px;
    font-weight: 400;
    color: #888888;
    line-height: 1;
  }
</style>
</head>
<body>
<div class="container">
  <svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="#F59E0B">
    <!-- Left bracket -->
    <rect x="13" y="13" width="10" height="74"/>
    <rect x="13" y="13" width="23" height="10"/>
    <rect x="13" y="77" width="23" height="10"/>
    <!-- Right bracket -->
    <rect x="77" y="13" width="10" height="74"/>
    <rect x="64" y="13" width="23" height="10"/>
    <rect x="64" y="77" width="23" height="10"/>
    <!-- Arrow: arrowhead then stem -->
    <polygon points="50,13 33,50 67,50"/>
    <rect x="44" y="50" width="12" height="27"/>
  </svg>
  <div class="text">
    <div class="name">cite.me.in</div>
    <div class="tagline">Monitor LLM citation visibility</div>
  </div>
</div>
</body>
</html>`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(html, { waitUntil: "networkidle" });

const outputPath = path.join(root, "public", "og-image.png");
await page.screenshot({ path: outputPath, type: "png" });
await browser.close();

console.log(`Saved: ${outputPath}`);
