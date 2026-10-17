/** Regenerates packages/shared/src/registry/catalog-summary.json from the YAML catalog. */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { toSummary } from '@everydaily/shared/registry/catalog-summary';
import { loadGames } from '@everydaily/shared/registry/loader';

const out = fileURLToPath(
  new URL('../packages/shared/src/registry/catalog-summary.json', import.meta.url),
);
const summary = toSummary(loadGames().map((g) => g.spec));
writeFileSync(out, JSON.stringify(summary, null, 2) + '\n');
console.log(`Wrote ${summary.length} games to ${out}`);
