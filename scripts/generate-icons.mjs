// Renders src/app/icon.svg into the PNG icons used by the PWA manifest and iOS.
// Usage: node scripts/generate-icons.mjs  (needs Playwright's Chromium)
import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const svg = await readFile(new URL("../src/app/icon.svg", import.meta.url), "utf8");
const toData = (source) => `data:image/svg+xml;base64,${Buffer.from(source).toString("base64")}`;
const svgData = toData(svg);
// Maskable variant: just the motif (the launcher draws its own shape).
const motifData = toData(svg.replace(/<rect width="512" height="512"[^>]*\/>/, ""));

const targets = [
  { file: "public/icons/icon-192.png", size: 192, maskable: false },
  { file: "public/icons/icon-512.png", size: 512, maskable: false },
  { file: "public/icons/maskable-512.png", size: 512, maskable: true },
  // iOS only rounds the corners: full bleed, but the motif as big as on the normal icon.
  { file: "src/app/apple-icon.png", size: 180, maskable: true, scale: 1 },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const { file, size, maskable, scale = 0.82 } of targets) {
  await page.setViewportSize({ width: size, height: size });
  // Maskable icons need a full-bleed background and the motif inside the safe zone.
  const inner = maskable ? Math.round(size * scale) : size;
  await page.setContent(`<html><body style="margin:0;background:${maskable ? "linear-gradient(135deg,#1c2438,#0c111e)" : "transparent"};display:grid;place-items:center;width:${size}px;height:${size}px">
    <img src="${maskable ? motifData : svgData}" style="width:${inner}px;height:${inner}px"></body></html>`);
  await page.waitForTimeout(50);
  const png = await page.screenshot({ omitBackground: !maskable, clip: { x: 0, y: 0, width: size, height: size } });
  await writeFile(new URL(`../${file}`, import.meta.url), png);
  console.log("wrote", file);
}
await browser.close();
