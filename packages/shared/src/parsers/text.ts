/** Text helpers shared by parsers. */

export const MAX_INPUT = 4096;

// Zero-width and bidi control characters that sneak in through copy/paste. U+200D (ZWJ) is kept
// because emoji sequences need it.
const INVISIBLE = /[\u200B\u200C\u2060\uFEFF\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;

/** NFKC, invisible characters removed, CRLF → LF, lines trimmed, runs of blank lines collapsed. */
export function normalizeInput(raw: string): string {
  return raw
    .normalize('NFKC')
    .replace(INVISIBLE, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[ \t\u00A0]+$/g, '').replace(/^[ \t\u00A0]+/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Splits into graphemes (emoji sequences stay together). */
export function graphemes(s: string): string[] {
  const seg = new Intl.Segmenter('en', { granularity: 'grapheme' });
  return Array.from(seg.segment(s), (x) => x.segment);
}

/** Strips variation selectors so 🟩 and 🟩️ compare equal. */
export function bare(g: string): string {
  return g.replace(/️/g, '');
}

/** Digits only (drops locale separators like "," "." and thin spaces). */
export function digits(s: string): number {
  return Number(s.replace(/[^\d]/g, ''));
}

const KEYCAP = /^([0-9])⃣$/;
/** Value of a scoreboard emoji: keycap digits, 🔟, clock faces 🕚🕛🕐 (11–13), 🟥 = failed (null). */
export function boardEmojiValue(g: string): number | null | undefined {
  const b = bare(g);
  const k = KEYCAP.exec(b);
  if (k) return Number(k[1]);
  switch (b) {
    case '🔟':
      return 10;
    case '🕚':
      return 11;
    case '🕛':
      return 12;
    case '🕐':
      return 13;
    case '🟥':
      return null;
    default:
      return undefined;
  }
}

const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

/** Month name or 3-letter abbreviation → 1–12. */
export function monthIndex(name: string): number | null {
  const n = name.toLowerCase();
  const i = MONTHS.findIndex((m) => m === n || m.slice(0, 3) === n);
  return i === -1 ? null : i + 1;
}

export function isoDate(y: number, m: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
