import { isoDate } from './text';
import { fail, type Parser } from './types';

/** Current share: a link carrying the puzzle date (d) and solve time in seconds (t). */
const LINK =
  /https:\/\/www\.nytimes\.com\/(?:badges\/games\/mini|shared\/v\d+\/mini-xwd)\.html\?[^\s]+/;
/** Older text share. */
const LEGACY =
  /I solved the (?:\w+day )?(\d{1,2})\/(\d{1,2})\/(\d{4}) New York Times Mini Crossword in (\d{1,2}):(\d{2})!/;

export const nytMini: Parser = {
  id: 'nyt-mini',
  detect: (t) => LINK.test(t) || LEGACY.test(t),
  extract(text) {
    if (/midi-xwd|daily midi/.test(text))
      return fail('not_this_game', 'This looks like a Midi result, not the Mini.');
    const link = LINK.exec(text);
    if (link) {
      const params = new URL(link[0]).searchParams;
      const d = params.get('d') ?? '';
      const t = params.get('t') ?? '';
      const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
      const date = dm ? isoDate(Number(dm[1]), Number(dm[2]), Number(dm[3])) : null;
      if (!date) return fail('malformed', 'The share link has no valid puzzle date.');
      if (!/^\d{1,5}$/.test(t)) return fail('malformed', 'The share link has no solve time.');
      return ok(date, Number(t));
    }
    const legacy = LEGACY.exec(text);
    if (legacy) {
      const date = isoDate(Number(legacy[3]), Number(legacy[1]), Number(legacy[2]));
      if (!date) return fail('malformed', 'That date does not exist.');
      return ok(date, Number(legacy[4]) * 60 + Number(legacy[5]));
    }
    return fail('not_this_game', 'Paste the Mini share link (it contains your time).');
  },
};

function ok(date: string, seconds: number) {
  if (seconds <= 0 || seconds >= 24 * 3600)
    return fail('inconsistent', 'That solve time is not plausible.');
  const mm = Math.floor(seconds / 60);
  const ss = String(seconds % 60).padStart(2, '0');
  return {
    ok: true as const,
    value: {
      by: 'date' as const,
      date,
      partial: {
        solved: true,
        timeSeconds: seconds,
        details: {},
        normalizedShareText: `The Mini · ${date} · ${mm}:${ss}`,
      },
    },
  };
}
