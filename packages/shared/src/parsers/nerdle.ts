import { bare, digits, graphemes } from './text';
import { fail, type Parser } from './types';

// Classic Nerdle only; mini, midi, maxi and other variants share differently prefixed headers.
const HEADER = /^nerdlegame (\d[\d,]*) ([1-6X])\/6$/im;
const CORRECT = '🟩';
const TILES = new Set(['🟩', '🟪', '⬛', '⬜']);

export const nerdle: Parser = {
  id: 'nerdle',
  detect: (t) => /^nerdlegame \d[\d,]* [1-6X]\/6/im.test(t),
  extract(text) {
    const m = HEADER.exec(text);
    if (!m) return fail('not_this_game', 'Expected a Nerdle share like "nerdlegame 1732 4/6".');
    const number = digits(m[1]!);
    const solved = m[2]!.toUpperCase() !== 'X';
    const attempts = solved ? Number(m[2]) : 6;

    const rows = text
      .slice(m.index + m[0].length)
      .split('\n')
      .map((l) => graphemes(l.trim()).map(bare))
      .filter((r) => r.length > 0 && r.every((g) => TILES.has(g)));
    if (rows.some((r) => r.length !== 8))
      return fail('malformed', 'Each Nerdle row should have eight tiles.');
    if (rows.length > 0) {
      if (rows.length !== attempts)
        return fail(
          'inconsistent',
          `The grid has ${rows.length} rows but the score says ${m[2]}/6.`,
        );
      const firstWin = rows.findIndex((r) => r.every((g) => g === CORRECT));
      if (solved && firstWin !== rows.length - 1)
        return fail('inconsistent', 'The grid does not end on the winning row.');
      if (!solved && firstWin !== -1)
        return fail('inconsistent', 'The grid shows a win but the score says X/6.');
    }

    return {
      ok: true,
      value: {
        by: 'number',
        number,
        partial: {
          solved,
          attempts: solved ? attempts : undefined,
          maxAttempts: 6,
          details: { grid: rows.map((r) => r.join('')).join('\n') || undefined },
          normalizedShareText: [
            `nerdlegame ${number} ${m[2]!.toUpperCase()}/6`,
            '',
            ...rows.map((r) => r.join('')),
          ]
            .join('\n')
            .trim(),
        },
      },
    };
  },
};
