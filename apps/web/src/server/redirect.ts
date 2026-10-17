/** Only same-site relative paths are allowed as post-login destinations. */
export function safeNext(next: string | null | undefined, fallback = '/today'): string {
  if (
    !next ||
    !next.startsWith('/') ||
    next.startsWith('//') ||
    next.startsWith('/\\') ||
    next.length > 200
  )
    return fallback;
  if (/^\/(login|start)(\/|$|\?)/.test(next)) return fallback;
  return next;
}
