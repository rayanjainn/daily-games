import { bare, graphemes } from './text';
import { fail, type Parser } from './types';

const HEADER = /^Connections\s*\nPuzzle #\s?([\d,]+)\s*$/m;
const COLORS = new Set(['🟨', '🟩', '🟦', '🟪']);

export const connections: Parser = {
  id: 'connections',
  detect: (t) => HEADER.test(t),
  extract(text) {
    if (/^Connections: Sports Edition/m.test(text))
      return fail('not_this_game', 'This is a Sports Edition result.');
    const m = HEADER.exec(text);
    if (!m)
      return fail(
        'not_this_game',
        'Expected a Connections share starting with "Connections" and "Puzzle #".',
      );
    const number = Number(m[1]!.replace(/,/g, ''));

    const rows = text
      .slice(m.index + m[0].length)
      .split('\n')
      .map((l) => graphemes(l.trim()).map(bare))
      .filter((r) => r.length > 0);
    if (rows.length < 4) return fail('malformed', 'A Connections result has at least four rows.');
    if (rows.length > 8) return fail('malformed', 'A Connections result has at most eight rows.');
    for (const r of rows) {
      if (r.length !== 4 || !r.every((g) => COLORS.has(g)))
        return fail('malformed', 'Each row should be four colored squares.');
    }

    const solvedColors = rows.filter((r) => r.every((g) => g === r[0])).map((r) => r[0]!);
    if (new Set(solvedColors).size !== solvedColors.length) {
      return fail('inconsistent', 'The same group appears as solved twice.');
    }
    const mistakes = rows.length - solvedColors.length;
    if (mistakes > 4) return fail('inconsistent', 'Connections ends after four mistakes.');
    const solved = solvedColors.length === 4;
    if (!solved && mistakes !== 4)
      return fail('inconsistent', 'An unfinished game must end on the fourth mistake.');
    // After the fourth mistake the game reveals the remaining groups, so a lost game may list
    // solved-looking rows after the last mistake; a won game cannot contain rows after its last solve.
    if (solved) {
      const lastSolve = rows.findLastIndex((r) => r.every((g) => g === r[0]));
      if (lastSolve !== rows.length - 1)
        return fail('inconsistent', 'A won game ends on a solved row.');
    }

    return {
      ok: true,
      value: {
        by: 'number',
        number,
        partial: {
          solved,
          score: mistakes,
          details: {
            mistakes,
            perfect: solved && mistakes === 0,
            grid: rows.map((r) => r.join('')).join('\n'),
          },
          normalizedShareText: [
            'Connections',
            `Puzzle #${number}`,
            ...rows.map((r) => r.join('')),
          ].join('\n'),
        },
      },
    };
  },
};
