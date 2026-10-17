import { bare, graphemes, isoDate, monthIndex } from './text';
import { fail, type Parser } from './types';

const HEADER = /^Minute Cryptic - (\d{1,2}) ([A-Za-z]+),? (\d{4})$/m;
const HINT = '⚪';
const LETTER = '🟡';
const UNUSED = '🟣';

export const minuteCryptic: Parser = {
  id: 'minute-cryptic',
  detect: (t) => HEADER.test(t),
  extract(text) {
    if (/member clue|Mini Crossword/.test(text))
      return fail('not_this_game', 'Only the daily clue is tracked here.');
    const h = HEADER.exec(text);
    if (!h)
      return fail('not_this_game', 'Expected a share starting with "Minute Cryptic - <date>".');
    const month = monthIndex(h[2]!);
    const date = month ? isoDate(Number(h[3]), month, Number(h[1])) : null;
    if (!date) return fail('malformed', 'Could not read the date in the share.');

    // The clue line (in quotes) is the publisher's content; it is read past, never stored.
    const lines = text
      .slice(h.index + h[0].length)
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const rowLine = lines.find((l) => {
      const gs = graphemes(l).map(bare);
      return gs.length > 0 && gs.every((g) => g === HINT || g === LETTER || g === UNUSED);
    });
    if (!rowLine) return fail('malformed', 'No hint row found in the share.');
    const row = graphemes(rowLine).map(bare);
    const hints = row.filter((g) => g === HINT).length;
    const letters = row.filter((g) => g === LETTER).length;
    const parLine = lines.find(
      (l) => /\b(?:under|over|at) par\b|\bpar\b/i.test(l) && !l.startsWith('"'),
    );

    return {
      ok: true,
      value: {
        by: 'date',
        date,
        partial: {
          solved: true,
          score: hints + letters,
          details: { hints, lettersRevealed: letters, par: parLine },
          normalizedShareText: [`Minute Cryptic - ${h[1]} ${h[2]}, ${h[3]}`, row.join(''), parLine]
            .filter(Boolean)
            .join('\n'),
        },
      },
    };
  },
};
