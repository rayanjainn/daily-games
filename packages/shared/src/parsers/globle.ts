import { bare, graphemes, isoDate, monthIndex } from './text';
import { fail, type Parser } from './types';

const HEADER = /^🌎 ([A-Za-z]{3,9}) (\d{1,2}), (\d{4}) 🌍$/mu;
const GUESSES = /^([^\n=]*?) = (\d{1,3})$/m;
const SQUARES = new Set(['🟥', '🟧', '🟨', '🟩', '⬜', '🟦', '🟫', '⬛']);

export const globle: Parser = {
  id: 'globle',
  detect: (t) => HEADER.test(t) || /#globle\b/i.test(t),
  extract(text) {
    const h = HEADER.exec(text);
    if (!h) return fail('not_this_game', 'Expected a Globle share starting with "🌎 <date> 🌍".');
    const month = monthIndex(h[1]!);
    const date = month ? isoDate(Number(h[3]), month, Number(h[2])) : null;
    if (!date) return fail('malformed', 'Could not read the date in the Globle share.');

    const g = GUESSES.exec(text);
    if (!g) return fail('malformed', 'Globle only shares a result after you find the country.');
    const guesses = Number(g[2]);
    const squares = graphemes(g[1]!.replace(/\s+/g, '')).map(bare);
    if (!squares.every((s) => SQUARES.has(s)))
      return fail('malformed', 'Unexpected characters in the Globle guesses.');
    if (squares.length !== guesses) {
      return fail('inconsistent', `Globle shows ${squares.length} guesses but says ${guesses}.`);
    }
    if (guesses < 1) return fail('malformed', 'At least one guess is needed.');

    return {
      ok: true,
      value: {
        by: 'date',
        date,
        partial: {
          solved: true,
          attempts: guesses,
          score: guesses,
          details: { grid: squares.join('') },
          normalizedShareText: `🌎 ${h[1]} ${h[2]}, ${h[3]} 🌍\n${squares.join('')} = ${guesses}`,
        },
      },
    };
  },
};
