// Pure helpers shared by the content script, the background worker and the options page.
// No browser APIs in here, so they can be unit tested in Node.

export const MAX_SHARE_LENGTH = 4000;

/**
 * A cheap filter run before anything leaves the page: share texts are short, multi-token and
 * almost always carry a number, a score or an emoji grid. Everything else a player copies on a
 * game site (a URL, a word) is ignored and never sent. The server checks the text again.
 */
export function looksLikeShare(text) {
  if (typeof text !== 'string') return false;
  const t = text.trim();
  if (t.length < 6 || t.length > MAX_SHARE_LENGTH) return false;
  if (!/\d/.test(t)) return false;
  const hasGrid = /[\u{1F7E5}-\u{1F7EB}⬛⬜\u{1F532}\u{1F533}✅❌\u{1F525}]/u.test(t);
  const hasScore = /(?:^|\s)(?:\d{1,3}|[Xx])\s?\/\s?\d{1,3}(?:\s|$)/m.test(t);
  const hasTime = /\b\d{1,2}:\d{2}\b/.test(t);
  return hasGrid || hasScore || hasTime || /#\s?\d/.test(t);
}

/** `https://example.com/anything?x` -> `https://example.com`, or null when it can't be used. */
export function normalizeAppUrl(input) {
  let u;
  try {
    u = new URL(String(input ?? '').trim());
  } catch {
    return null;
  }
  const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) return null;
  return u.origin;
}

/** Tokens look like edx_ followed by url-safe characters. */
export function validToken(token) {
  return /^edx_[A-Za-z0-9_-]{20,120}$/.test(String(token ?? '').trim());
}

/** The permission pattern the extension asks for to reach the app. */
export function originPattern(appUrl) {
  return `${new URL(appUrl).origin}/*`;
}

/** Remembers recent texts so a copy event and a clipboard call for one share send once. */
export function createDedupe(ttlMs = 15000, now = () => Date.now()) {
  const seen = new Map();
  return (text) => {
    const t = now();
    for (const [k, at] of seen) if (t - at > ttlMs) seen.delete(k);
    if (seen.has(text)) return false;
    seen.set(text, t);
    return true;
  };
}

/** Turns an API reply into what the badge and popup show. */
export function describeReply(status, body) {
  const err = body && body.error ? body.error : {};
  if (status === 200)
    return {
      kind: 'saved',
      badge: '✓',
      text: `Saved ${body.game?.name ?? 'result'} ${body.summary ?? ''}`.trim(),
    };
  if (status === 409)
    return {
      kind: 'duplicate',
      badge: '=',
      text: `Already logged${body?.error?.summary ? ` (${body.error.summary})` : ''}`,
    };
  if (status === 401)
    return {
      kind: 'auth',
      badge: '!',
      text: 'The token no longer works. Make a new one in Settings.',
    };
  if (status === 422 && err.code === 'unknown_game')
    return { kind: 'ignored', badge: '', text: 'Not a result from a game in the catalog.' };
  if (status === 422)
    return { kind: 'refused', badge: '?', text: err.message || 'That result was not accepted.' };
  if (status === 429)
    return { kind: 'slow', badge: '…', text: 'Too many results at once. Try again shortly.' };
  return { kind: 'error', badge: '!', text: err.message || `Something went wrong (${status}).` };
}
