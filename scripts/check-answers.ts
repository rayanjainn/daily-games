/**
 * Fetches today's answer from every publisher source and prints a one-line summary, so a broken
 * source shows up before players notice. Usage: pnpm check:answers [YYYY-MM-DD]
 */
import { ANSWER_SOURCES, type Answer } from '@everydaily/shared/answers';
import { clockOf } from '@everydaily/shared/registry/spec';
import { loadGames } from '@everydaily/shared/registry/loader';
import { puzzleNumberForDate } from '@everydaily/shared/time/puzzle';

const date =
  process.argv[2] ??
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());

const get = async (url: string, as: 'json' | 'text') => {
  const res = await fetch(url, {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; EveryDaily/1.0)' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  return as === 'json' ? res.json() : res.text();
};

const describe = (a: Answer): string => {
  switch (a.kind) {
    case 'word':
      return `word of ${a.word.length} letters`;
    case 'groups':
      return `${a.groups.length} groups`;
    case 'theme':
      return `spangram + ${a.words.length} theme words`;
    case 'wordlist':
      return `${a.words.length} words, ${a.pangrams.length} pangram(s)`;
    case 'sequence':
      return `${a.words.length}-word solution`;
    case 'crossword':
      return `${a.grid.length}×${a.grid[0]?.length ?? 0} grid, ${a.clues.length} clues`;
    case 'numbers':
      return `${a.grids.length} sudoku grid(s)`;
    case 'dominoes':
      return `${a.levels.length} level(s)`;
  }
};

const games = new Map(loadGames().map((g) => [g.spec.slug, g.spec]));
let failed = 0;
for (const [slug, source] of Object.entries(ANSWER_SOURCES)) {
  const spec = games.get(slug);
  if (!spec) {
    console.log(`✗ ${slug}: not in the catalog`);
    failed++;
    continue;
  }
  const number = puzzleNumberForDate(clockOf(spec), date);
  try {
    const answer = await source.fetch({ date, number }, get);
    console.log(answer ? `✓ ${slug}: ${describe(answer)}` : `– ${slug}: nothing for ${date}`);
  } catch (err) {
    failed++;
    console.log(`✗ ${slug}: ${String(err)}`);
  }
}
process.exit(failed ? 1 : 0);
