/**
 * Normalized key used to dedupe games (catalog and user submissions): lowercase host without
 * `www.`, lowercase path without trailing slash or index.html; scheme, port, query and fragment
 * dropped.
 */
export function normalizeGameUrl(input: string): string {
  const u = new URL(input.trim());
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('unsupported URL scheme');
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  let path = u.pathname.toLowerCase().replace(/\/index\.html?$/, '/');
  path = path.replace(/\/+$/, '');
  return `${host}${path}`;
}
