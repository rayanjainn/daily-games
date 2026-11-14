import type { Answer } from './types';

/**
 * Turns each publisher's own data into an Answer. Pure functions over the parsed JSON (or HTML),
 * so they are unit tested with made-up data of the same shape.
 */
type J = Record<string, unknown>;
const obj = (v: unknown): J | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as J) : null;
const str = (v: unknown) => (typeof v === 'string' ? v : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export function wordleAnswer(data: unknown, date: string): Answer | null {
  const d = obj(data);
  const word = str(d?.solution);
  if (!d || !word || str(d.print_date) !== date) return null;
  return { kind: 'word', word: word.toUpperCase() };
}

export function connectionsAnswer(data: unknown, date: string): Answer | null {
  const d = obj(data);
  if (!d || str(d.print_date) !== date) return null;
  const groups = arr(d.categories).flatMap((c) => {
    const cat = obj(c);
    const title = str(cat?.title);
    const items = arr(cat?.cards)
      .map((x) => str(obj(x)?.content))
      .filter((x): x is string => Boolean(x));
    return title && items.length ? [{ title, items }] : [];
  });
  return groups.length ? { kind: 'groups', groups } : null;
}

export function strandsAnswer(data: unknown, date: string): Answer | null {
  const d = obj(data);
  if (!d || str(d.printDate) !== date) return null;
  const spangram = str(d.spangram);
  const words = arr(d.themeWords).filter((w): w is string => typeof w === 'string');
  if (!spangram || !words.length) return null;
  return { kind: 'theme', clue: str(d.clue) ?? '', spangram, words };
}

/** NYT puzzle pages carry their data as `window.gameData = {...}`. */
export function pageGameData(html: string): J | null {
  const m = /window\.gameData\s*=\s*(\{[\s\S]*?\})\s*<\/script>/.exec(html);
  if (!m) return null;
  try {
    return obj(JSON.parse(m[1]!));
  } catch {
    return null;
  }
}

export function spellingBeeAnswer(html: string, date: string): Answer | null {
  const t = obj(pageGameData(html)?.today);
  if (!t || str(t.printDate) !== date) return null;
  const center = str(t.centerLetter) ?? '';
  const outer = arr(t.outerLetters).filter((x): x is string => typeof x === 'string');
  const words = arr(t.answers).filter((x): x is string => typeof x === 'string');
  if (!center || !words.length) return null;
  return {
    kind: 'wordlist',
    center: center.toUpperCase(),
    letters: (center + outer.join('')).toUpperCase(),
    pangrams: arr(t.pangrams)
      .filter((x): x is string => typeof x === 'string')
      .map((w) => w.toUpperCase()),
    words: words.map((w) => w.toUpperCase()).sort(),
  };
}

export function letterBoxedAnswer(html: string, date: string): Answer | null {
  const d = pageGameData(html);
  if (!d) return null;
  // The page shows today's puzzle and yesterday's solution.
  const printed = str(d.printDate);
  const yesterday = printed ? previousDay(printed) : null;
  const list =
    printed === date ? arr(d.ourSolution) : yesterday === date ? arr(d.yesterdaysSolution) : [];
  const words = list.filter((x): x is string => typeof x === 'string');
  if (!words.length) return null;
  return { kind: 'sequence', words, note: 'The setter’s own solution; others work too.' };
}

export function sudokuAnswer(html: string, date: string): Answer | null {
  const d = pageGameData(html);
  if (!d) return null;
  const grids = (['easy', 'medium', 'hard'] as const).flatMap((level) => {
    const l = obj(d[level]);
    if (!l || str(l.print_date) !== date) return [];
    const solution = arr(obj(l.puzzle_data)?.solution).map((n) => Number(n));
    if (solution.length !== 81 || solution.some((n) => !Number.isInteger(n) || n < 1 || n > 9))
      return [];
    const grid = Array.from({ length: 9 }, (_, r) => solution.slice(r * 9, r * 9 + 9));
    return [{ level: level[0]!.toUpperCase() + level.slice(1), grid }];
  });
  return grids.length ? { kind: 'numbers', grids } : null;
}

export function pipsAnswer(data: unknown, date: string): Answer | null {
  const d = obj(data);
  if (!d || str(d.printDate) !== date) return null;
  const levels = (['easy', 'medium', 'hard'] as const).flatMap((level) => {
    const l = obj(d[level]);
    const dominoes = arr(l?.dominoes);
    const solution = arr(l?.solution);
    if (!l || !dominoes.length || dominoes.length !== solution.length) return [];
    const placements = solution.map((cells, i) => ({
      pips: arr(dominoes[i]).map(Number) as [number, number],
      cells: arr(cells).map((c) => arr(c).map(Number) as [number, number]),
    }));
    return [{ level: level[0]!.toUpperCase() + level.slice(1), placements }];
  });
  return levels.length ? { kind: 'dominoes', levels } : null;
}

export function miniAnswer(data: unknown, date: string): Answer | null {
  const d = obj(data);
  if (!d || str(d.publicationDate) !== date) return null;
  const body = obj(arr(d.body)[0]);
  const dims = obj(body?.dimensions);
  const width = Number(dims?.width);
  const height = Number(dims?.height);
  const cells = arr(body?.cells).map((c) => str(obj(c)?.answer) ?? '');
  if (!body || !width || !height || cells.length !== width * height) return null;
  const grid = Array.from({ length: height }, (_, r) => cells.slice(r * width, r * width + width));
  const clues = arr(body.clues).flatMap((c) => {
    const clue = obj(c);
    const text = str(obj(arr(clue?.text)[0])?.plain);
    const label = str(clue?.label);
    const direction = str(clue?.direction);
    const idx = arr(clue?.cells).map(Number);
    if (!text || !label || (direction !== 'Across' && direction !== 'Down')) return [];
    return [
      { label, direction, clue: text, answer: idx.map((i) => cells[i] ?? '').join('') } as const,
    ];
  });
  return { kind: 'crossword', grid, clues };
}

export function contextoAnswer(data: unknown): Answer | null {
  const word = str(obj(data)?.word);
  return word ? { kind: 'word', word: word.toUpperCase() } : null;
}

function previousDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
