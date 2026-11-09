// Renders stage.html frame by frame (every frame a pure function of time) and encodes the video.
// Usage: node render.mjs <landscape|vertical> <out-dir> [stillsOnly]
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const [format = 'landscape', outDir = resolve(here, '../../brag-output'), stills] =
  process.argv.slice(2);
const V = format === 'vertical';
const [W, H] = V ? [1080, 1920] : [1920, 1080];
const FPS = 30;
const DURATION = 20;
const shots = resolve(outDir, 'work/shots');
const frames = resolve(outDir, `work/frames-${format}`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
const url = pathToFileURL(join(here, 'stage.html'));
url.search = `?format=${format}&shots=${encodeURIComponent(pathToFileURL(shots).href)}`;
await page.goto(url.href);
await page.evaluate(() => window.__ready);

if (stills) {
  mkdirSync(resolve(outDir, 'work/stills'), { recursive: true });
  for (const t of stills.split(',').map(Number)) {
    await page.evaluate((x) => window.renderAt(x), t);
    await page.screenshot({ path: resolve(outDir, `work/stills/${format}-${t}.png`) });
  }
  await browser.close();
  process.exit(0);
}

rmSync(frames, { recursive: true, force: true });
mkdirSync(frames, { recursive: true });
for (let f = 0; f < FPS * DURATION; f++) {
  await page.evaluate((x) => window.renderAt(x), f / FPS);
  await page.screenshot({
    path: join(frames, `${String(f).padStart(4, '0')}.jpg`),
    type: 'jpeg',
    quality: 94,
  });
}
await browser.close();
const out = resolve(outDir, `brag-${format}.mp4`);
execFileSync('ffmpeg', [
  '-y',
  '-loglevel',
  'error',
  '-framerate',
  String(FPS),
  '-i',
  join(frames, '%04d.jpg'),
  '-i',
  resolve(outDir, 'work/music.wav'),
  '-filter_complex',
  '[1:a]loudnorm=I=-14:TP=-1.5:LRA=9[a]',
  '-map',
  '0:v',
  '-map',
  '[a]',
  '-c:v',
  'libx264',
  '-preset',
  'slow',
  '-crf',
  '17',
  '-pix_fmt',
  'yuv420p',
  '-c:a',
  'aac',
  '-b:a',
  '192k',
  '-t',
  String(DURATION),
  '-movflags',
  '+faststart',
  out,
]);
console.log('wrote', out);
