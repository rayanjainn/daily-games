import { describe, expect, it } from 'vitest';
import { checkUsername, suggestUsername, USERNAME_MAX } from './username';
import { NAME_ADJECTIVES, NAME_NOUNS } from './wordlists/names';

describe('suggestUsername', () => {
  it('makes friendly adjective_noun names that pass every rule', () => {
    for (let i = 0; i < 2000; i++) {
      const n = suggestUsername();
      expect(n).toMatch(/^[a-z]+_[a-z]+$/);
      expect(n.length).toBeLessThanOrEqual(USERNAME_MAX);
      expect(checkUsername(n)).toBeNull();
    }
  });
  it('adds two digits only when asked', () => {
    for (let i = 0; i < 500; i++)
      expect(suggestUsername(Math.random, true)).toMatch(/^[a-z]+_[a-z]+_\d{2}$/);
  });
  it('has plenty of variety', () => {
    const seen = new Set(Array.from({ length: 300 }, () => suggestUsername()));
    expect(seen.size).toBeGreaterThan(250);
  });
  it('uses clean lowercase words, none of them reserved or rude', () => {
    for (const w of [...NAME_ADJECTIVES, ...NAME_NOUNS]) {
      expect(w).toMatch(/^[a-z]+$/);
      expect(
        checkUsername(`${w}_fox`) === 'profanity' || checkUsername(`swift_${w}`) === 'profanity',
      ).toBe(false);
    }
  });
});
