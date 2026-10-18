/**
 * Size budgets, checked after `next build` (CI runs it after the e2e build):
 *  - total gzipped JavaScript the browser can be sent (apps/web/.next/static/chunks)
 *  - the largest single JavaScript file, gzipped
 *  - every image in apps/web/public
 *
 * The limits sit a little above today's sizes, so a change that makes the app noticeably
 * heavier fails here and has to say why. Raise a limit in this file deliberately, not casually.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const web = fileURLToPath(new URL('../apps/web', import.meta.url));
const KB = 1024;

export const BUDGETS = {
  totalJsGzip: 700 * KB,
  largestJsGzip: 110 * KB,
  imageBytes: 220 * KB,
};

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}

export function measure(root: string) {
  const js = walk(join(root, '.next/static/chunks')).filter((f) => f.endsWith('.js'));
  const sizes = js.map((f) => ({
    file: f.slice(root.length + 1),
    gz: gzipSync(readFileSync(f)).length,
  }));
  const images = walk(join(root, 'public'))
    .filter((f) => /\.(png|jpe?g|webp|avif|gif)$/i.test(f))
    .map((f) => ({ file: f.slice(root.length + 1), bytes: statSync(f).size }));
  return {
    totalJs: sizes.reduce((n, s) => n + s.gz, 0),
    largestJs: sizes.sort((a, b) => b.gz - a.gz)[0] ?? { file: '(none)', gz: 0 },
    images,
  };
}

const kb = (n: number) => `${(n / KB).toFixed(1)} KB`;

function main() {
  const m = measure(web);
  const problems: string[] = [];
  console.log(`JavaScript, gzipped: ${kb(m.totalJs)} in total (budget ${kb(BUDGETS.totalJsGzip)})`);
  console.log(
    `Largest file: ${m.largestJs.file} at ${kb(m.largestJs.gz)} (budget ${kb(BUDGETS.largestJsGzip)})`,
  );
  if (m.totalJs > BUDGETS.totalJsGzip) problems.push('Total JavaScript is over budget.');
  if (m.largestJs.gz > BUDGETS.largestJsGzip)
    problems.push(`${m.largestJs.file} is over the single-file budget.`);
  for (const i of m.images)
    if (i.bytes > BUDGETS.imageBytes)
      problems.push(
        `${i.file} is ${kb(i.bytes)}; images may be ${kb(BUDGETS.imageBytes)} at most.`,
      );
  console.log(`Images checked: ${m.images.length}`);
  if (problems.length) {
    console.error(`\nOver budget:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    process.exit(1);
  }
  console.log('Within budget.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
