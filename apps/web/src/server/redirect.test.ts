import { describe, expect, it } from 'vitest';
import { safeNext } from './redirect';

describe('safeNext', () => {
  it.each([
    ['/games/wordle', '/games/wordle'],
    ['/today?x=1', '/today?x=1'],
    [null, '/today'],
    ['https://evil.example', '/today'],
    ['//evil.example', '/today'],
    ['/\\evil.example', '/today'],
    ['/login', '/today'],
    ['/start?x', '/today'],
    ['javascript:alert(1)', '/today'],
  ])('%s → %s', (input, out) => {
    expect(safeNext(input)).toBe(out);
  });
});
