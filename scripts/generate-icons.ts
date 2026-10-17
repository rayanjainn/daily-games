/**
 * Renders the app icons (PNG) from apps/web/public/icons/icon.svg (and icon-mono.svg for the
 * one-colour themed icon) with headless Chromium.
 * Usage: pnpm icons:generate   (re-run after changing the SVG; the PNGs are committed)
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const dir = fileURLToPath(new URL('../apps/web/public/icons/', import.meta.url));
const svg = readFileSync(`${dir}icon.svg`, 'utf8');
const mono = readFileSync(`${dir}icon-mono.svg`, 'utf8');
const PAPER = '#FDF2E1';

/** `pad` is the share of the canvas left around the mark; maskable icons need a safe zone. */
const OUTPUTS = [
  { file: 'icon-192.png', size: 192, pad: 0.06, bg: 'transparent' },
  { file: 'icon-512.png', size: 512, pad: 0.06, bg: 'transparent' },
  { file: 'maskable-512.png', size: 512, pad: 0.2, bg: PAPER },
  { file: 'apple-touch-icon.png', size: 180, pad: 0.12, bg: PAPER },
  { file: 'favicon-32.png', size: 32, pad: 0, bg: 'transparent' },
  // Themed icons are cropped like maskable ones, so the mark keeps the same safe zone.
  { file: 'monochrome-512.png', size: 512, pad: 0.2, bg: 'transparent', src: mono },
];

const browser = await chromium.launch(
  process.env.PLAYWRIGHT_BROWSERS_PATH ? {} : { executablePath: '/opt/pw-browsers/chromium' },
);
try {
  const page = await browser.newPage();
  for (const o of OUTPUTS) {
    const inner = Math.round(o.size * (1 - o.pad * 2));
    await page.setViewportSize({ width: o.size, height: o.size });
    await page.setContent(
      `<html><body style="margin:0;background:${o.bg};display:grid;place-items:center;width:${o.size}px;height:${o.size}px">` +
        (o.src ?? svg).replace('<svg ', `<svg width="${inner}" height="${inner}" `) +
        '</body></html>',
    );
    await page.screenshot({ path: `${dir}${o.file}`, omitBackground: o.bg === 'transparent' });
    console.log(`wrote ${o.file}`);
  }
} finally {
  await browser.close();
}
