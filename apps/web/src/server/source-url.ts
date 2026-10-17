/** True for a public https page: no credentials, no IP literals, no local or internal hosts. */
export function isPublicHttpsUrl(s: string): boolean {
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return false;
  }
  return (
    u.protocol === 'https:' &&
    !u.username &&
    !u.password &&
    u.hostname.includes('.') &&
    !/^[\d.]+$/.test(u.hostname) &&
    !u.hostname.startsWith('[') &&
    !/(^|\.)(localhost|local|internal)$/i.test(u.hostname)
  );
}
