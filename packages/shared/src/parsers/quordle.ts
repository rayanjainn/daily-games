import { distinctSolves, readBoardRows } from './boards';
import { fail, type Parser } from './types';

const HEADER = /^(?:\S+ )?Daily Quordle #?(\d{1,6})\s*$/m;
const MAX_GUESSES = 9;

export const quordle: Parser = {
  id: 'quordle',
  detect: (t) => HEADER.test(t),
  extract(text) {
    if (/Daily (?:Chill|Extreme|Rescue|Sequence)/.test(text)) {
      return fail('not_this_game', 'Only the classic Daily Quordle is tracked here.');
    }
    const m = HEADER.exec(text);
    if (!m) return fail('not_this_game', 'Expected a share starting with "Daily Quordle".');
    const lines = text
      .slice(m.index + m[0].length)
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const rows = readBoardRows(lines.slice(0, 2), 2);
    if (!rows || rows.length !== 2)
      return fail('malformed', 'Expected two rows of two board scores.');
    const boards = rows.flat();
    if (boards.some((b) => b !== null && (b < 1 || b > MAX_GUESSES))) {
      return fail('inconsistent', `Daily Quordle allows ${MAX_GUESSES} guesses.`);
    }
    if (!distinctSolves(boards))
      return fail('inconsistent', 'Two boards cannot be solved on the same guess.');

    const solved = boards.every((b) => b !== null);
    const attempts = solved ? Math.max(...(boards as number[])) : undefined;
    // Sum of guesses with a miss counted as 10 (one past the limit), for comparing results.
    const score = boards.reduce<number>((s, b) => s + (b ?? MAX_GUESSES + 1), 0);
    const emoji = (b: number | null) => (b === null ? '🟥' : `${b}️⃣`);
    return {
      ok: true,
      value: {
        by: 'number',
        number: Number(m[1]),
        partial: {
          solved,
          attempts,
          maxAttempts: MAX_GUESSES,
          score,
          details: { boards },
          normalizedShareText: [
            `Daily Quordle ${m[1]}`,
            emoji(boards[0]!) + emoji(boards[1]!),
            emoji(boards[2]!) + emoji(boards[3]!),
          ].join('\n'),
        },
      },
    };
  },
};
