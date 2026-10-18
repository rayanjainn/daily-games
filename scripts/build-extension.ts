/**
 * Builds the browser extension into apps/extension/dist (and a zip next to it).
 *
 * The sites it runs on come from the game catalog, so adding a game with a parser adds its site
 * here on the next build. `--dev` also runs it on localhost so it can be tried against a local
 * app or test pages.
 */
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateRawSync } from 'node:zlib';
import { hostOf } from '@everydaily/shared/catalog/capture';
import { loadGames } from '@everydaily/shared/registry/loader';

const root = fileURLToPath(new URL('..', import.meta.url));
const ext = join(root, 'apps/extension');
const dist = join(ext, 'dist');
const dev = process.argv.includes('--dev');

export function matchPatterns(
  games: { url: string; parserId?: string | null; embedMode?: string }[],
  withLocalhost: boolean,
): string[] {
  const hosts = new Set<string>();
  for (const g of games) {
    const h = hostOf(g.url);
    if (h && g.parserId && g.embedMode !== 'native') hosts.add(h);
  }
  const out = [...hosts].sort().map((h) => `https://*.${h}/*`);
  if (withLocalhost) out.push('http://localhost/*', 'http://127.0.0.1/*');
  return out;
}

function listFiles(dir: string, base = dir): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? listFiles(join(dir, e.name), base)
      : [join(dir, e.name).slice(base.length + 1)],
  );
}

/** A small zip writer (deflate, no extras): enough for the Chrome Web Store and "Load unpacked". */
function zip(files: { name: string; data: Buffer }[]): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name);
    const body = deflateRawSync(f.data);
    const crc = crc32(f.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // utf-8 names
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0x0021, 12); // fixed date: 1980-01-01, so builds are reproducible
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(f.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    parts.push(local, name, body);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(0x0800, 8);
    c.writeUInt16LE(8, 10);
    c.writeUInt16LE(0x0021, 14);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(body.length, 20);
    c.writeUInt32LE(f.data.length, 24);
    c.writeUInt16LE(name.length, 28);
    c.writeUInt32LE(offset, 42);
    central.push(c, name);
    offset += local.length + name.length + body.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, end]);
}

function build() {
  const games = loadGames().map((g) => g.spec);
  const matches = matchPatterns(games, dev);
  const manifest = JSON.parse(readFileSync(join(ext, 'src/manifest.template.json'), 'utf8'));
  manifest.content_scripts = [
    { matches, js: ['page-hook.js'], world: 'MAIN', run_at: 'document_start', all_frames: true },
    { matches, js: ['content.js'], run_at: 'document_start', all_frames: true },
  ];

  // Dev builds may reach a local app without asking; real builds ask for the app's address.
  if (dev) manifest.host_permissions = ['http://localhost/*', 'http://127.0.0.1/*'];

  rmSync(dist, { recursive: true, force: true });
  mkdirSync(join(dist, 'icons'), { recursive: true });
  for (const f of readdirSync(join(ext, 'src'))) {
    if (f === 'manifest.template.json' || f.endsWith('.test.js')) continue;
    copyFileSync(join(ext, 'src', f), join(dist, f));
  }
  const icon = join(root, 'apps/web/public/icons/icon-192.png');
  copyFileSync(icon, join(dist, 'icons/icon-48.png'));
  copyFileSync(icon, join(dist, 'icons/icon-128.png'));
  writeFileSync(join(dist, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

  const files = listFiles(dist)
    .sort()
    .map((name) => ({ name, data: readFileSync(join(dist, name)) }));
  const zipPath = join(ext, dev ? 'everydaily-extension-dev.zip' : 'everydaily-extension.zip');
  writeFileSync(zipPath, zip(files));
  console.log(`Built ${files.length} files for ${matches.length} site patterns -> ${dist}`);
  console.log(`Zip: ${zipPath}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) build();
