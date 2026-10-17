import { bare, graphemes } from './text';
import { fail, type Parser } from './types';

/**
 * Tier 2: pulls out what most daily-game shares have in common — a puzzle number, an "N/M" score
 * and an emoji grid — and leaves the rest to manual entry. Results are keyed by the day they are
 * logged (or an explicit archive date); the shared number is kept as metadata.
 */
const NUMBER = /#\s?[A-Za-z]*\s?#?\s?(\d{1,6})\b|^[A-Za-z][\w ]{1,30}? #?(\d{1,6})\b/m;
const SCORE = /(?:^|\s)([0-9]{1,3}|[Xx])\s?\/\s?([0-9]{1,3})(?=\s|\*|$)/m;

export const generic: Parser = {
  id: 'generic',
  detect: () => false,
  extract(text) {
    const n = NUMBER.exec(text);
    const s = SCORE.exec(text);
    if (!n && !s) return fail('malformed', 'Could not find a puzzle number or score in that text.');

    let score: number | undefined;
    let max: number | undefined;
    let solved = true;
    if (s) {
      max = Number(s[2]);
      if (max < 1 || max > 100) return fail('malformed', 'That score does not look right.');
      if (/x/i.test(s[1]!)) solved = false;
      else {
        score = Number(s[1]);
        if (score > max) return fail('inconsistent', `Score ${score}/${max} is out of range.`);
      }
    }

    const grid = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => {
        const gs = graphemes(l.replace(/\s+/g, ''));
        return (
          gs.length > 0 &&
          gs.every((g) => /\p{Extended_Pictographic}|⃣/u.test(g) && !/[\p{L}\p{N}]/u.test(bare(g)))
        );
      })
      .join('\n');

    return {
      ok: true,
      value: {
        by: 'today',
        partial: {
          solved,
          attempts: score,
          maxAttempts: max,
          score,
          details: { sharedNumber: n ? Number(n[1] ?? n[2]) : undefined, grid: grid || undefined },
          normalizedShareText: text
            .split('\n')
            .filter((l) => !/^https?:\/\//.test(l))
            .join('\n')
            .slice(0, 600),
        },
      },
    };
  },
};
