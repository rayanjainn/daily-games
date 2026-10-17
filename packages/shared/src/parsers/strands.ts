import { bare, graphemes } from './text';
import { fail, type Parser } from './types';

const HEADER = /^(?:Archive [^\n]+\n)?Strands #\s?([\d,]+)\s*$/m;
const HINT = '💡';
const SPANGRAM = '🟡';

export const strands: Parser = {
  id: 'strands',
  detect: (t) => HEADER.test(t),
  extract(text) {
    const m = HEADER.exec(text);
    if (!m) return fail('not_this_game', 'Expected a Strands share like "Strands #123".');
    const number = Number(m[1]!.replace(/,/g, ''));
    const lines = text
      .slice(m.index + m[0].length)
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    // The theme line is quoted; it is a spoiler and third-party content, so it is not stored.
    if (lines[0] && /^["“”'‘]/.test(lines[0])) lines.shift();

    const rows = lines
      .map((l) => graphemes(l).map(bare))
      .filter((r) => r.length > 0 && r.length <= 4);
    const cells = rows.flat();
    if (cells.length === 0) return fail('malformed', 'No Strands grid found.');
    if (rows.length !== lines.length)
      return fail('malformed', 'Unexpected text in the Strands grid.');
    if (rows.slice(0, -1).some((r) => r.length !== 4))
      return fail('malformed', 'Strands rows have four entries.');
    if (cells.some((g) => /^[\p{L}\p{N}]$/u.test(g)))
      return fail('malformed', 'Unexpected text in the Strands grid.');

    const hints = cells.filter((g) => g === HINT).length;
    const words = cells.length - hints;
    const spangrams = cells.filter((g) => g === SPANGRAM).length;
    if (words < 3)
      return fail('inconsistent', 'A finished Strands puzzle has more words than that.');
    if (spangrams > 1) return fail('inconsistent', 'There is only one spangram.');

    return {
      ok: true,
      value: {
        by: 'number',
        number,
        partial: {
          solved: true,
          score: hints,
          details: { hints, words, grid: rows.map((r) => r.join('')).join('\n') },
          normalizedShareText: [`Strands #${number}`, ...rows.map((r) => r.join(''))].join('\n'),
        },
      },
    };
  },
};
