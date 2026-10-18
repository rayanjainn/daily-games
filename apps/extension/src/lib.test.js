import { describe, expect, it } from 'vitest';
import {
  createDedupe,
  describeReply,
  looksLikeShare,
  normalizeAppUrl,
  originPattern,
  validToken,
} from './lib.js';

describe('looksLikeShare', () => {
  it('accepts typical share texts', () => {
    expect(looksLikeShare('Wordle 1,200 3/6\n\n⬛🟨⬛⬛🟩\n🟩🟩🟩🟩🟩')).toBe(true);
    expect(looksLikeShare('Connections\nPuzzle #500\n🟨🟨🟨🟨\n🟩🟩🟩🟩')).toBe(true);
    expect(looksLikeShare('The Mini 0:45 today')).toBe(true);
  });
  it('ignores ordinary copies', () => {
    expect(looksLikeShare('hello')).toBe(false);
    expect(looksLikeShare('https://example.com/play')).toBe(false);
    expect(looksLikeShare('a word with no score at all')).toBe(false);
    expect(looksLikeShare('x'.repeat(5000) + ' 3/6')).toBe(false);
    expect(looksLikeShare(42)).toBe(false);
  });
});

describe('normalizeAppUrl', () => {
  it('keeps only the origin and requires https', () => {
    expect(normalizeAppUrl('https://everydaily.example/settings?x=1')).toBe(
      'https://everydaily.example',
    );
    expect(normalizeAppUrl('http://localhost:3000/')).toBe('http://localhost:3000');
    expect(normalizeAppUrl('http://everydaily.example')).toBeNull();
    expect(normalizeAppUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeAppUrl('')).toBeNull();
  });
  it('builds the permission pattern', () => {
    expect(originPattern('https://a.example:8443')).toBe('https://a.example:8443/*');
  });
});

describe('validToken', () => {
  it('checks the shape only', () => {
    expect(validToken('edx_' + 'a'.repeat(43))).toBe(true);
    expect(validToken(' edx_' + 'a'.repeat(43) + ' ')).toBe(true);
    expect(validToken('nope')).toBe(false);
    expect(validToken(undefined)).toBe(false);
  });
});

describe('createDedupe', () => {
  it('lets a text through once per window', () => {
    let t = 0;
    const ok = createDedupe(1000, () => t);
    expect(ok('a')).toBe(true);
    expect(ok('a')).toBe(false);
    expect(ok('b')).toBe(true);
    t = 2000;
    expect(ok('a')).toBe(true);
  });
});

describe('describeReply', () => {
  it('maps the API outcomes', () => {
    expect(describeReply(200, { game: { name: 'Wordle' }, summary: '3/6' })).toMatchObject({
      kind: 'saved',
      text: 'Saved Wordle 3/6',
    });
    expect(describeReply(409, { error: { code: 'duplicate' } }).kind).toBe('duplicate');
    expect(describeReply(401, {}).kind).toBe('auth');
    expect(describeReply(422, { error: { code: 'unknown_game' } }).kind).toBe('ignored');
    expect(describeReply(422, { error: { code: 'ambiguous_game', message: 'Which?' } }).kind).toBe(
      'refused',
    );
    expect(describeReply(429, {}).kind).toBe('slow');
    expect(describeReply(500, {}).kind).toBe('error');
  });
});
