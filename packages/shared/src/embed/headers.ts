/**
 * Reads X-Frame-Options and CSP frame-ancestors to decide whether a page lets another site
 * frame it. Used by the submission flow, the worker's weekly re-probe and scripts/probe-embeds.
 * Headers can only say "blocked" for sure; "allowed" still needs a real browser load.
 */
export type HeaderVerdict =
  | { verdict: 'blocked'; reason: string }
  | { verdict: 'allowed'; reason: string }
  | { verdict: 'unknown'; reason: string };

/** Extracts the frame-ancestors sources from one or more CSP header values. */
export function frameAncestors(csp: string | null | undefined): string[] | null {
  if (!csp) return null;
  // Multiple policies (comma-joined headers) all apply; the first frame-ancestors per policy counts.
  let result: string[] | null = null;
  for (const policy of csp.split(',')) {
    for (const directive of policy.split(';')) {
      const [name, ...sources] = directive.trim().split(/\s+/);
      if (name?.toLowerCase() === 'frame-ancestors') {
        const list = sources.map((s) => s.toLowerCase());
        // Several policies: a source must be allowed by every one, so keep the strictest.
        result = result === null ? list : result.filter((s) => list.includes(s));
        break;
      }
    }
  }
  return result;
}

function hostMatches(source: string, origin: URL): boolean {
  if (source === '*') return true;
  if (source === 'https:') return origin.protocol === 'https:';
  const m = /^(?:(https?):\/\/)?(\*\.)?([^/:]+)(?::(\d+|\*))?/.exec(source);
  if (!m) return false;
  const [, scheme, wildcard, host] = m;
  if (scheme && `${scheme}:` !== origin.protocol) return false;
  if (wildcard) return origin.hostname.endsWith(`.${host}`);
  return origin.hostname === host;
}

/**
 * Header-level verdict for framing `pageUrl` from `embedderOrigin`.
 * CSP frame-ancestors wins over X-Frame-Options when both are present (per the CSP spec).
 */
export function analyzeFrameHeaders(
  headers: { xFrameOptions?: string | null; csp?: string | null },
  embedderOrigin: string,
  pageUrl: string,
): HeaderVerdict {
  const embedder = new URL(embedderOrigin);
  const page = new URL(pageUrl);
  const ancestors = frameAncestors(headers.csp);
  if (ancestors !== null) {
    if (ancestors.length === 0 || ancestors.includes("'none'"))
      return { verdict: 'blocked', reason: "CSP frame-ancestors 'none'" };
    const allowed = ancestors.some((s) =>
      s === "'self'" ? embedder.origin === page.origin : hostMatches(s, embedder),
    );
    return allowed
      ? { verdict: 'allowed', reason: `CSP frame-ancestors allows ${embedder.host}` }
      : { verdict: 'blocked', reason: `CSP frame-ancestors: ${ancestors.join(' ')}` };
  }
  const xfo = headers.xFrameOptions?.trim().toUpperCase();
  if (xfo) {
    if (xfo === 'DENY') return { verdict: 'blocked', reason: 'X-Frame-Options: DENY' };
    if (xfo === 'SAMEORIGIN')
      return embedder.origin === page.origin
        ? { verdict: 'allowed', reason: 'X-Frame-Options: SAMEORIGIN (same origin)' }
        : { verdict: 'blocked', reason: 'X-Frame-Options: SAMEORIGIN' };
    // ALLOW-FROM and unknown values are ignored by modern browsers.
    return { verdict: 'unknown', reason: `X-Frame-Options: ${xfo} (ignored by browsers)` };
  }
  return { verdict: 'unknown', reason: 'no framing headers; needs a browser check' };
}
