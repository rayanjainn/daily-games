import { distinctSolves, readBoardRows } from './boards';
import { fail, type Parser } from './types';

const HEADER = /^Daily Octordle #(\d{1,6})\s*$/m;
const MAX_GUESSES = 13;
const MISS_POINTS = 14;

export const octordle: Parser = {
  id: 'octordle',
  detect: (t) => HEADER.test(t),
  extract(text) {
    if (
      /Daily (?:Casual |)(?:Sequence|Rescue|Chill|Extreme) Octordle|Daily Casual Octordle/.test(
        text,
      )
    ) {
      return fail('not_this_game', 'Only the classic Daily Octordle is tracked here.');
    }
    const m = HEADER.exec(text);
    if (!m) return fail('not_this_game', 'Expected a share starting with "Daily Octordle #".');
    const lines = text
      .slice(m.index + m[0].length)
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const rows = readBoardRows(lines.slice(0, 4), 2);
    if (!rows || rows.length !== 4)
      return fail('malformed', 'Expected four rows of two board scores.');
    const boards = rows.flat();
    if (boards.some((b) => b !== null && (b < 1 || b > MAX_GUESSES))) {
      return fail('inconsistent', `Daily Octordle allows ${MAX_GUESSES} guesses.`);
    }
    if (!distinctSolves(boards))
      return fail('inconsistent', 'Two boards cannot be solved on the same guess.');

    const score = boards.reduce<number>((s, b) => s + (b ?? MISS_POINTS), 0);
    const scoreLine = /^Score: (\d{1,3})$/m.exec(text);
    if (scoreLine && Number(scoreLine[1]) !== score) {
      return fail('inconsistent', `The board scores add up to ${score}, not ${scoreLine[1]}.`);
    }

    const solved = boards.every((b) => b !== null);
    const clock = [
      '',
      '1️⃣',
      '2️⃣',
      '3️⃣',
      '4️⃣',
      '5️⃣',
      '6️⃣',
      '7️⃣',
      '8️⃣',
      '9️⃣',
      '🔟',
      '🕚',
      '🕛',
      '🕐',
    ];
    const emoji = (b: number | null) => (b === null ? '🟥' : clock[b]!);
    return {
      ok: true,
      value: {
        by: 'number',
        number: Number(m[1]),
        partial: {
          solved,
          attempts: solved ? Math.max(...(boards as number[])) : undefined,
          maxAttempts: MAX_GUESSES,
          score,
          details: { boards },
          normalizedShareText: [
            `Daily Octordle #${m[1]}`,
            ...rows.map((r) => r.map(emoji).join('')),
            `Score: ${score}`,
          ].join('\n'),
        },
      },
    };
  },
};
