import { describe, expect, it } from 'vitest';
import { hostOf, resolveCaptureGame, sameSite, type CaptureGame } from './capture';

const g = (
  slug: string,
  url: string,
  parserId: string | null,
  embedMode = 'popout',
): CaptureGame => ({
  slug,
  url,
  parserId,
  embedMode,
});

const WORDLE = 'Wordle 1,200 3/6\n\n⬛🟨⬛⬛⬛\n🟩🟩⬛⬛⬛\n🟩🟩🟩🟩🟩';

describe('hostOf and sameSite', () => {
  it('ignores www and bad input', () => {
    expect(hostOf('https://www.nytimes.com/games/wordle')).toBe('nytimes.com');
    expect(hostOf('nonsense')).toBeNull();
    expect(hostOf(undefined)).toBeNull();
  });
  it('accepts subdomains but not look-alikes', () => {
    expect(sameSite('a.example.com', 'example.com')).toBe(true);
    expect(sameSite('notexample.com', 'example.com')).toBe(false);
  });
});

describe('resolveCaptureGame', () => {
  const games = [
    g('wordle', 'https://www.nytimes.com/games/wordle', 'wordle'),
    g('some-game', 'https://some.example/', 'generic'),
    g('other-game', 'https://other.example/', 'generic'),
    g('cipher', 'https://everydaily.example/g/cipher', null, 'native'),
  ];

  it('picks the game whose format the text matches', () => {
    expect(resolveCaptureGame(games, WORDLE)).toEqual({ ok: true, slug: 'wordle' });
  });
  it('uses the page address for generic games', () => {
    expect(resolveCaptureGame(games, 'x 3/6', 'https://some.example/play')).toEqual({
      ok: true,
      slug: 'some-game',
    });
  });
  it('does not guess without a page address or a known format', () => {
    expect(resolveCaptureGame(games, 'x 3/6')).toEqual({ ok: false, code: 'unknown_game' });
    expect(resolveCaptureGame(games, 'x 3/6', 'https://nowhere.example')).toEqual({
      ok: false,
      code: 'unknown_game',
    });
  });
  it('asks for help when two games share a site and a format', () => {
    const two = [
      g('a', 'https://s.example/a', 'generic'),
      g('b', 'https://s.example/b', 'generic'),
    ];
    expect(resolveCaptureGame(two, 'x 3/6', 'https://s.example')).toEqual({
      ok: false,
      code: 'ambiguous_game',
    });
  });
  it('never routes to native games', () => {
    expect(resolveCaptureGame(games, 'x', 'https://everydaily.example/g/cipher')).toEqual({
      ok: false,
      code: 'unknown_game',
    });
  });
});
