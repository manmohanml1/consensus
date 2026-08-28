import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const sizes = [192, 512];
const svg = await readFile("public/icons/consensus.svg", "utf8");
const source = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
const browser = await chromium.launch({ headless: true });

try {
  for (const size of sizes) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    await page.setContent(`
      <style>
        * { box-sizing: border-box; }
        html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; }
        img { display: block; width: 100%; height: 100%; }
      </style>
      <img alt="" src="${source}">
    `);
    await page.locator("img").waitFor();
    await page.screenshot({ path: `public/icons/consensus-${size}.png` });
    await page.close();
  }
} finally {
  await browser.close();
}
