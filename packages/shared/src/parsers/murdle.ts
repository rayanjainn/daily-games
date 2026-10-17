import { bare, boardEmojiValue, graphemes, isoDate } from './text';
import { fail, type Parser } from './types';

const HEADER = /^Murdle for (\d{1,2})\/(\d{1,2})\/(\d{4})$/im;
const RIGHT = new Set(['✅', '🟩']);
const WRONG = new Set(['❌', '⬛']);
const HINT = '🔮';

/** "2️⃣3️⃣:4️⃣8️⃣" (keycap digits) → seconds. */
function keycapTime(line: string): number | null {
  const [mm, ss] = line.split(':');
  if (mm === undefined || ss === undefined) return null;
  const num = (part: string) => {
    const gs = graphemes(part.trim());
    if (!gs.length) return null;
    let n = 0;
    for (const g of gs) {
      const v = boardEmojiValue(g);
      if (v === undefined || v === null || v > 9) return null;
      n = n * 10 + v;
    }
    return n;
  };
  const m = num(mm);
  const s = num(ss);
  if (m === null || s === null || s > 59) return null;
  return m * 60 + s;
}

/**
 * Murdle shares the day's title (publisher content, never stored), the date, one mark per
 * question (who, what, where and sometimes why), hints as 🔮, the time in keycap digits and a
 * ⚖️ line that shows ❌ when the accusation was wrong.
 */
export const murdle: Parser = {
  id: 'murdle',
  detect: (t) => HEADER.test(t),
  extract(text) {
    const h = HEADER.exec(text);
    if (!h) return fail('not_this_game', 'Expected a Murdle share with "Murdle for M/D/YYYY".');
    const date = isoDate(Number(h[3]), Number(h[1]), Number(h[2]));
    if (!date) return fail('malformed', 'Could not read the date in the share.');

    const after = text.slice(h.index + h[0].length);
    const lines = after
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    let marks: string[] | null = null;
    let hints = 0;
    let seconds: number | null = null;
    for (const line of lines) {
      for (const chunk of line.split(/\s{2,}|\s(?=[\d\u{1F570}])/u)) {
        const c = chunk.replace(/^🕰️?|^⏱️?/u, '').trim();
        if (!c) continue;
        const gs = graphemes(c.replace(/\s/g, '')).map(bare);
        if (
          !marks &&
          gs.length >= 3 &&
          gs.every((g) => RIGHT.has(g) || WRONG.has(g) || g === HINT)
        ) {
          marks = gs.filter((g) => g !== HINT);
          hints += gs.filter((g) => g === HINT).length;
          continue;
        }
        if (gs.length && gs.every((g) => g === HINT)) {
          hints += gs.length;
          continue;
        }
        if (seconds === null && c.includes(':')) seconds = keycapTime(c);
      }
    }
    if (!marks || marks.length < 3 || marks.length > 4)
      return fail('malformed', 'No answer marks (✅/❌) found in the share.');
    const verdictWrong = /⚖️?\s*\n?\s*❌/u.test(after);
    const solved = marks.every((g) => RIGHT.has(g)) && !verdictWrong;

    return {
      ok: true,
      value: {
        by: 'date',
        date,
        partial: {
          solved,
          timeSeconds: seconds ?? undefined,
          details: {
            answers: marks.map((g) => (RIGHT.has(g) ? 1 : 0)),
            hints,
          },
          normalizedShareText: [
            `Murdle for ${h[1]}/${h[2]}/${h[3]}`,
            marks.map((g) => (RIGHT.has(g) ? '✅' : '❌')).join('') +
              (hints ? ` ${HINT.repeat(hints)}` : ''),
            seconds !== null
              ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
              : null,
          ]
            .filter(Boolean)
            .join('\n'),
        },
      },
    };
  },
};
