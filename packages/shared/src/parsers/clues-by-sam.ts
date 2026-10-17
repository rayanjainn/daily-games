import { bare, graphemes, isoDate, monthIndex } from './text';
import { fail, type Parser } from './types';

const HEADER =
  /#CluesBySam,\s+([A-Za-z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})(?:\s+\(([^)]{1,20})\))?(?:,\s+in\s+(?:less than\s+(\d{1,3})\s+minutes?|(\d{1,2}):(\d{2})))?/i;
// From the game's own code: 🟨 error, 🟡 hint, 🟠 second hint; 🟩 a clean deduction.
const CLEAN = '🟩';
const KIND: Record<string, 'error' | 'hint' | 'secondHint'> = {
  '🟨': 'error',
  '🟡': 'hint',
  '🟠': 'secondHint',
};

export const cluesBySam: Parser = {
  id: 'clues-by-sam',
  detect: (t) => /#CluesBySam\b/i.test(t),
  extract(text) {
    const h = HEADER.exec(text);
    if (!h) return fail('not_this_game', 'Expected a share with "#CluesBySam, <date>".');
    const month = monthIndex(h[1]!);
    const date = month ? isoDate(Number(h[3]), month, Number(h[2])) : null;
    if (!date) return fail('malformed', 'Could not read the date in the share.');
    const solved = /\bI solved\b/i.test(text.slice(0, h.index + 40));

    const rows = text
      .slice(h.index + h[0].length)
      .split('\n')
      .map((l) => graphemes(l.trim()).map(bare))
      .filter((r) => r.length > 0 && r.every((g) => g === CLEAN || g in KIND));
    if (!rows.length) return fail('malformed', 'No suspect grid found in the share.');
    const tiles = rows.flat();
    const count = (k: string) => tiles.filter((g) => KIND[g] === k).length;
    const errors = count('error');
    const hints = count('hint');
    const secondHints = count('secondHint');
    const exact = h[6] !== undefined ? Number(h[6]) * 60 + Number(h[7]) : null;
    const underMinutes = h[5] !== undefined ? Number(h[5]) : null;

    return {
      ok: true,
      value: {
        by: 'date',
        date,
        partial: {
          solved,
          // Lower is better: every tile that needed a hint or had a wrong guess.
          score: errors + hints + secondHints,
          timeSeconds: exact ?? undefined,
          details: {
            grid: rows.map((r) => r.join('')).join('\n'),
            errors,
            hints,
            secondHints,
            difficulty: h[4] ?? null,
            underMinutes,
          },
          normalizedShareText: [
            `#CluesBySam ${h[1]} ${h[2]} ${h[3]}${h[4] ? ` (${h[4]})` : ''}${
              exact !== null
                ? `, ${h[6]}:${h[7]}`
                : underMinutes !== null
                  ? `, under ${underMinutes} min`
                  : ''
            }`,
            ...rows.map((r) => r.join('')),
          ].join('\n'),
        },
      },
    };
  },
};
