import { describe, expect, it } from 'vitest';
import { isPublicHttpsUrl } from './source-url';

describe('isPublicHttpsUrl', () => {
  it.each([
    'https://www.nytimes.com/2026/10/16/crosswords/wordle-review.html',
    'https://example.org/answers?day=16',
  ])('accepts %s', (u) => expect(isPublicHttpsUrl(u)).toBe(true));

  it.each([
    'http://example.org/answers',
    'javascript:alert(1)',
    'https://user:pw@example.org/',
    'https://127.0.0.1/',
    'https://[::1]/',
    'https://localhost/',
    'https://printer.local/',
    'https://intranet/',
    'not a url',
  ])('rejects %s', (u) => expect(isPublicHttpsUrl(u)).toBe(false));
});
