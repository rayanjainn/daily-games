import { bare, graphemes, isoDate } from './text';
import { fail, type Parser } from './types';

const HEADER =
  /^#Worldle #(\d{1,6}) \((\d{2})\.(\d{2})\.(\d{4})\) ([1-6X]|😛)\/6(?: \((\d{1,3})%\))?(?: \S+)?$/mu;
const SQUARES = new Set(['🟩', '🟨', '⬛', '⬜']);

export const worldle: Parser = {
  id: 'worldle',
  detect: (t) => /^#Worldle #\d+/m.test(t),
  extract(text) {
    const m = HEADER.exec(text);
    if (!m)
      return fail(
        'not_this_game',
        'Expected a Worldle share like "#Worldle #123 (17.10.2026) 3/6".',
      );
    const date = isoDate(Number(m[4]), Number(m[3]), Number(m[2]));
    if (!date) return fail('malformed', 'The date in the Worldle share does not exist.');
    const solved = /^[1-6]$/.test(m[5]!);
    const attempts = solved ? Number(m[5]) : 6;

    const rows = text
      .split('\n')
      .map((l) => graphemes(l.trim()).map(bare))
      .filter((r) => r.length >= 5 && r.slice(0, 5).every((g) => SQUARES.has(g)));
    if (rows.length > 0 && solved && rows.length !== attempts) {
      return fail(
        'inconsistent',
        `The grid has ${rows.length} rows but the score says ${attempts}/6.`,
      );
    }
    if (rows.length > 0 && solved && rows.at(-1)![5] !== '🎉') {
      return fail('inconsistent', 'A solved Worldle ends with the 🎉 row.');
    }

    return {
      ok: true,
      value: {
        by: 'number',
        number: Number(m[1]),
        date,
        partial: {
          solved,
          attempts: solved ? attempts : undefined,
          maxAttempts: 6,
          details: { grid: rows.map((r) => r.join('')).join('\n') || undefined },
          normalizedShareText: [
            `#Worldle #${m[1]} (${m[2]}.${m[3]}.${m[4]}) ${m[5]}/6`,
            ...rows.map((r) => r.join('')),
          ].join('\n'),
        },
      },
    };
  },
};
