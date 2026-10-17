import { digits } from './text';
import { fail, type Parser } from './types';

// The main daily round only. Themed rounds add " · YYYY-MM-DD" to the title and practice rounds
// add " · PRACTICE"; neither is the Daily Dive.
const HEADER = /^KRILLION · THE DAILY DIVE$/im;
const SCORE = /^(\d{1,3})\/700 · ([\d.,\s\u202f]+) m$/m;
const MAX = 700;

/**
 * Krillion shares no date or number, so the result is for the current puzzle (reset at 00:00
 * UTC). The score is out of 700; the depth line is derived from it and only checked for shape.
 */
export const krillion: Parser = {
  id: 'krillion',
  detect: (t) => HEADER.test(t),
  extract(text) {
    if (!HEADER.test(text))
      return fail(
        'not_this_game',
        'Expected a Daily Dive share starting "KRILLION · THE DAILY DIVE".',
      );
    const m = SCORE.exec(text);
    if (!m) return fail('malformed', 'Expected a score line like "420/700 · 4,200 m".');
    const score = Number(m[1]);
    if (score > MAX) return fail('inconsistent', `Scores go up to ${MAX}.`);
    const depth = digits(m[2]!);

    return {
      ok: true,
      value: {
        by: 'today',
        partial: {
          solved: true,
          score,
          details: { depthMeters: depth },
          normalizedShareText: `KRILLION · THE DAILY DIVE\n${score}/${MAX} · ${depth.toLocaleString('en-US')} m`,
        },
      },
    };
  },
};
