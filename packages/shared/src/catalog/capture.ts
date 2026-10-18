import { detectParsers } from '../parsers';

export interface CaptureGame {
  slug: string;
  url: string;
  parserId: string | null;
  embedMode: string;
}

export type CaptureMatch =
  { ok: true; slug: string } | { ok: false; code: 'unknown_game' | 'ambiguous_game' };

/** `www.nytimes.com` and `nytimes.com` are the same site for our purposes. */
export function hostOf(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h.startsWith('www.') ? h.slice(4) : h;
  } catch {
    return null;
  }
}

/** The page's host is the game's host, or one of its subdomains. */
export function sameSite(pageHost: string, gameHost: string): boolean {
  return pageHost === gameHost || pageHost.endsWith(`.${gameHost}`);
}

/**
 * Works out which game a captured share text belongs to. The text decides when its format is
 * recognised; the page address breaks ties and covers games that only have the generic parser.
 * Native games are never captured: they save their own results.
 */
export function resolveCaptureGame(
  games: CaptureGame[],
  shareText: string,
  pageUrl?: string | null,
): CaptureMatch {
  const capturable = games.filter((g) => g.parserId && g.embedMode !== 'native');
  const pageHost = hostOf(pageUrl);
  const onPage = pageHost
    ? capturable.filter((g) => {
        const h = hostOf(g.url);
        return h !== null && sameSite(pageHost, h);
      })
    : [];

  const detected = new Set(detectParsers(shareText));
  const byFormat = capturable.filter((g) => detected.has(g.parserId!));

  const pick = (list: CaptureGame[]): CaptureMatch =>
    list.length === 1 ? { ok: true, slug: list[0]!.slug } : { ok: false, code: 'ambiguous_game' };

  if (byFormat.length) {
    if (byFormat.length === 1) return pick(byFormat);
    const both = byFormat.filter((g) => onPage.includes(g));
    return pick(both);
  }
  if (onPage.length) return pick(onPage);
  return { ok: false, code: 'unknown_game' };
}
