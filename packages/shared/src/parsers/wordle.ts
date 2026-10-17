import { bare, digits, graphemes } from './text';
import { fail, type Parser } from './types';

const HEADER = /^(?:Archive [^\n]+\n)?Wordle ([\d.,\s\u202F]{1,9}?) ([1-6X])\/6(\*)?$/m;
const CORRECT = new Set(['🟩', '🟧']);
const TILES = new Set(['🟩', '🟨', '⬛', '⬜', '🟧', '🟦']);

export const wordle: Parser = {
  id: 'wordle',
  detect: (t) => /^(?:Archive [^\n]+\n)?Wordle [\d.,\s\u202F]+ [1-6X]\/6/m.test(t),
  extract(text) {
    const m = HEADER.exec(text);
    if (!m) return fail('not_this_game', 'Expected a Wordle share like "Wordle 1,234 4/6".');
    const number = digits(m[1]!);
    const solved = m[2] !== 'X';
    const attempts = solved ? Number(m[2]) : 6;

    const rows = text
      .slice(m.index + m[0].length)
      .split('\n')
      .map((l) => graphemes(l.trim()).map(bare))
      .filter((r) => r.length > 0 && r.every((g) => TILES.has(g)));
    if (rows.some((r) => r.length !== 5))
      return fail('malformed', 'Each Wordle row should have five tiles.');
    if (rows.length > 0) {
      if (rows.length !== attempts)
        return fail(
          'inconsistent',
          `The grid has ${rows.length} rows but the score says ${m[2]}/6.`,
        );
      const solvedRows = rows.map((r) => r.every((g) => CORRECT.has(g)));
      const firstWin = solvedRows.indexOf(true);
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
          details: {
            hardMode: Boolean(m[3]),
            grid: rows.map((r) => r.join('')).join('\n') || undefined,
          },
          normalizedShareText: [
            `Wordle ${number.toLocaleString('en-US')} ${m[2]}/6${m[3] ?? ''}`,
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
