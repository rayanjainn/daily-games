import { describe, expect, it } from 'vitest';
import { loadGames } from '../registry/loader';
import { detectParsers, parseShareText, PARSERS, type ParseContext } from './index';

const catalog = loadGames();
const NOW = new Date('2026-10-17T15:00:00Z');

function ctxFor(slug: string, over: Partial<ParseContext> = {}): ParseContext {
  const g = catalog.find((x) => x.spec.slug === slug)!.spec;
  return {
    game: {
      slug,
      tier: g.tier,
      clock: { reset: g.reset, numbering: g.numbering },
      numberingPublic: g.numbering.public,
      maxAttempts: g.scoring.maxAttempts ?? null,
    },
    now: NOW,
    userTimeZone: 'America/New_York',
    ...over,
  };
}
const parse = (slug: string, text: string, over: Partial<ParseContext> = {}) => {
  const g = catalog.find((x) => x.spec.slug === slug)!.spec;
  return parseShareText(text, g.parserId!, ctxFor(slug, over));
};
const expectOk = (r: ReturnType<typeof parse>) => {
  if (!r.ok) throw new Error(`${r.code}: ${r.message}`);
  return r.value;
};
const expectErr = (r: ReturnType<typeof parse>, code: string) => {
  expect(r.ok ? 'ok' : r.code).toBe(code);
};

describe('registry ↔ parsers', () => {
  it('every parserId in the catalog has a parser', () => {
    for (const { spec } of catalog)
      if (spec.parserId) expect(PARSERS[spec.parserId], spec.slug).toBeDefined();
  });

  it.each(
    catalog
      .filter((g) => g.spec.shareTextSamples.length)
      .flatMap((g) => g.spec.shareTextSamples.map((s, i) => [g.spec.slug, i, s] as const)),
  )('%s sample %i parses', (slug, _i, sample) => {
    expectOk(parse(slug, sample));
  });

  it.each(
    catalog
      .filter((g) => g.spec.tier === 1)
      .map((g) => [g.spec.slug, g.spec.shareTextSamples[0]!, g.spec.parserId!] as const),
  )('%s samples are detected as their own game', (_slug, sample, parserId) => {
    expect(detectParsers(sample)).toContain(parserId);
  });

  it('tier 1 parsers do not claim each other’s samples', () => {
    for (const { spec } of catalog.filter((g) => g.spec.tier === 1)) {
      for (const s of spec.shareTextSamples)
        expect(detectParsers(s), spec.slug).toEqual([spec.parserId]);
    }
  });
});

describe('input handling', () => {
  it('rejects empty and over-long input', () => {
    expectErr(parse('wordle', '   \n '), 'empty');
    expectErr(parse('wordle', 'Wordle 1,946 4/6\n' + 'x'.repeat(5000)), 'too_long');
  });

  it('survives zero-width characters, CRLF, fullwidth digits and stray indentation', () => {
    const v = expectOk(
      parse(
        'wordle',
        '\u200BWordle １,９４６ 3/6\r\n\r\n  ⬛🟨⬛⬛⬛\r\n🟩⬛🟩⬛🟩\r\n🟩🟩🟩🟩🟩  ',
      ),
    );
    expect(v.puzzleNumber).toBe(1946);
    expect(v.attempts).toBe(3);
  });

  it('rejects text for a different game', () => {
    expectErr(
      parse('wordle', 'Connections\nPuzzle #1224\n🟨🟨🟨🟨\n🟩🟩🟩🟩\n🟦🟦🟦🟦\n🟪🟪🟪🟪'),
      'not_this_game',
    );
    expectErr(parse('connections', 'Wordle 1,946 4/6'), 'not_this_game');
  });
});

describe('wordle', () => {
  it('reads number, score, hard mode and grid', () => {
    const v = expectOk(
      parse('wordle', 'Wordle 1,946 4/6*\n\n⬛🟨⬛⬛⬛\n⬛⬛🟩🟨⬛\n🟩⬛🟩⬛🟩\n🟩🟩🟩🟩🟩'),
    );
    expect(v).toMatchObject({
      puzzleNumber: 1946,
      puzzleDate: '2026-10-17',
      solved: true,
      attempts: 4,
      maxAttempts: 6,
    });
    expect(v.details.hardMode).toBe(true);
  });

  it.each(['Wordle 1.946 4/6', 'Wordle 1 946 4/6', 'Wordle 1\u202F946 4/6', 'Wordle 1946 4/6'])(
    'accepts locale number format %j',
    (t) => {
      expect(expectOk(parse('wordle', t)).puzzleNumber).toBe(1946);
    },
  );

  it('accepts archive shares and failed games', () => {
    const v = expectOk(
      parse(
        'wordle',
        'Archive October 1, 2026\nWordle 1,930 X/6\n\n⬜⬜🟨⬜⬜\n🟨🟩⬜⬜⬜\n⬜🟩🟩⬜🟩\n⬜🟩🟩🟨🟩\n🟨🟩🟩⬜🟩\n⬜🟩🟩🟩🟩',
      ),
    );
    expect(v).toMatchObject({ puzzleNumber: 1930, solved: false, attempts: undefined });
  });

  it('accepts high-contrast colors', () => {
    expectOk(parse('wordle', 'Wordle 1,946 2/6\n\n🟦🟧⬛⬛⬛\n🟧🟧🟧🟧🟧'));
  });

  it('rejects tampered grids', () => {
    expectErr(
      parse('wordle', 'Wordle 1,946 2/6\n\n⬛🟨⬛⬛⬛\n⬛⬛🟩🟨⬛\n🟩🟩🟩🟩🟩'),
      'inconsistent',
    );
    expectErr(
      parse('wordle', 'Wordle 1,946 3/6\n\n🟩🟩🟩🟩🟩\n⬛⬛🟩🟨⬛\n🟩🟩🟩🟩🟩'),
      'inconsistent',
    );
    expectErr(
      parse(
        'wordle',
        'Wordle 1,946 X/6\n\n⬛⬛⬛⬛⬛\n⬛⬛⬛⬛⬛\n⬛⬛⬛⬛⬛\n⬛⬛⬛⬛⬛\n⬛⬛⬛⬛⬛\n🟩🟩🟩🟩🟩',
      ),
      'inconsistent',
    );
    expectErr(parse('wordle', 'Wordle 1,946 1/6\n\n🟩🟩🟩🟩'), 'malformed');
  });

  it('rejects future and pre-launch puzzles but allows the newest puzzle anywhere on Earth', () => {
    expectErr(parse('wordle', 'Wordle 1,948 4/6'), 'future_puzzle');
    expectErr(
      parse('wordle', 'Wordle 1,948 4/6', { now: new Date('2026-10-17T09:00:00Z') }),
      'future_puzzle',
    );
    // 11:00Z is already Oct 18 in UTC+14.
    expectOk(parse('wordle', 'Wordle 1,947 4/6', { now: new Date('2026-10-17T11:00:00Z') }));
    expectErr(
      parse('wordle', 'Wordle 1,947 4/6', { now: new Date('2026-10-17T09:00:00Z') }),
      'future_puzzle',
    );
  });

  it('rejects impossible scores', () => {
    expectErr(parse('wordle', 'Wordle 1,946 7/6'), 'not_this_game');
    expectErr(parse('wordle', 'Wordle 1,946 0/6'), 'not_this_game');
  });
});

describe('connections', () => {
  it('counts mistakes and detects a perfect game', () => {
    const perfect = expectOk(
      parse('connections', 'Connections\nPuzzle #1224\n🟪🟪🟪🟪\n🟨🟨🟨🟨\n🟩🟩🟩🟩\n🟦🟦🟦🟦'),
    );
    expect(perfect).toMatchObject({
      puzzleNumber: 1224,
      puzzleDate: '2026-10-17',
      solved: true,
      score: 0,
    });
    expect(perfect.details.perfect).toBe(true);
    const two = expectOk(
      parse(
        'connections',
        'Connections\nPuzzle #1224\n🟨🟩🟨🟨\n🟨🟨🟨🟨\n🟩🟦🟩🟩\n🟩🟩🟩🟩\n🟦🟦🟦🟦\n🟪🟪🟪🟪',
      ),
    );
    expect(two.score).toBe(2);
  });

  it('reads a lost game (four mistakes)', () => {
    const v = expectOk(
      parse(
        'connections',
        'Connections\nPuzzle #1224\n🟨🟩🟨🟨\n🟨🟨🟨🟨\n🟩🟦🟩🟩\n🟩🟦🟪🟩\n🟦🟩🟦🟦',
      ),
    );
    expect(v).toMatchObject({ solved: false, score: 4 });
  });

  it('rejects tampering', () => {
    expectErr(
      parse('connections', 'Connections\nPuzzle #1224\n🟨🟨🟨🟨\n🟨🟨🟨🟨\n🟩🟩🟩🟩\n🟦🟦🟦🟦'),
      'inconsistent',
    );
    expectErr(
      parse('connections', 'Connections\nPuzzle #1224\n🟨🟩🟨🟨\n🟨🟨🟨🟨\n🟩🟩🟩🟩'),
      'malformed',
    );
    expectErr(
      parse('connections', 'Connections\nPuzzle #1224\n🟨🟨🟨\n🟨🟨🟨🟨\n🟩🟩🟩🟩\n🟦🟦🟦🟦'),
      'malformed',
    );
    expectErr(
      parse(
        'connections',
        'Connections\nPuzzle #1224\n🟨🟩🟨🟨\n🟨🟨🟨🟨\n🟩🟩🟩🟩\n🟦🟦🟦🟦\n🟪🟪🟪🟪\n🟩🟦🟩🟩',
      ),
      'inconsistent',
    );
  });

  it('refuses the Sports Edition', () => {
    expectErr(
      parse(
        'connections',
        'Connections: Sports Edition\nPuzzle #300\n🟨🟨🟨🟨\n🟩🟩🟩🟩\n🟦🟦🟦🟦\n🟪🟪🟪🟪',
      ),
      'not_this_game',
    );
  });
});

describe('strands', () => {
  it('counts hints and drops the theme line', () => {
    const v = expectOk(parse('strands', 'Strands #958\n“Kitchen drawer”\n🔵🔵💡🔵\n🔵🟡🔵🔵'));
    expect(v).toMatchObject({ puzzleNumber: 958, solved: true, score: 1 });
    expect(v.normalizedShareText).not.toContain('Kitchen');
  });

  it('rejects malformed grids', () => {
    expectErr(parse('strands', 'Strands #958\n“Theme”\n🔵🔵🔵🔵🔵\n🟡'), 'malformed');
    expectErr(parse('strands', 'Strands #958\n“Theme”\n🟡🟡🔵🔵'), 'inconsistent');
    expectErr(parse('strands', 'Strands #958'), 'malformed');
  });
});

describe('nyt mini', () => {
  it('reads date and time from the share link', () => {
    const v = expectOk(
      parse(
        'nyt-mini',
        'I solved the daily mini!\nhttps://www.nytimes.com/badges/games/mini.html?d=2026-10-17&t=42&c=abc&smid=url-share',
      ),
    );
    expect(v).toMatchObject({ puzzleDate: '2026-10-17', timeSeconds: 42, solved: true });
    expect(v.normalizedShareText).toBe('The Mini · 2026-10-17 · 0:42');
  });

  it('reads the legacy text share', () => {
    const v = expectOk(
      parse('nyt-mini', 'I solved the 10/16/2026 New York Times Mini Crossword in 1:07!'),
    );
    expect(v).toMatchObject({ puzzleDate: '2026-10-16', timeSeconds: 67 });
  });

  it('accepts tomorrow’s Mini after its 10 p.m. Eastern release', () => {
    // 2026-10-18 02:30Z = 22:30 Eastern on the 17th → the 18th's puzzle is out.
    expectOk(
      parse('nyt-mini', 'https://www.nytimes.com/badges/games/mini.html?d=2026-10-18&t=50&c=x', {
        now: new Date('2026-10-18T02:30:00Z'),
      }),
    );
    expectErr(
      parse('nyt-mini', 'https://www.nytimes.com/badges/games/mini.html?d=2026-10-19&t=50&c=x'),
      'future_puzzle',
    );
  });

  it('rejects midi, bad dates and implausible times', () => {
    expectErr(
      parse('nyt-mini', 'https://www.nytimes.com/shared/v1/midi-xwd.html?d=2026-10-17&t=80&c=x'),
      'not_this_game',
    );
    expectErr(
      parse('nyt-mini', 'https://www.nytimes.com/badges/games/mini.html?d=2026-02-30&t=42&c=x'),
      'malformed',
    );
    expectErr(
      parse('nyt-mini', 'https://www.nytimes.com/badges/games/mini.html?d=2026-10-17&t=0&c=x'),
      'inconsistent',
    );
    expectErr(
      parse('nyt-mini', 'https://www.nytimes.com/badges/games/mini.html?d=2026-10-17&c=x'),
      'malformed',
    );
  });
});

describe('quordle', () => {
  it('reads boards, solved state and score', () => {
    const v = expectOk(
      parse('quordle', '🙂 Daily Quordle 1727\n5️⃣7️⃣\n8️⃣4️⃣\nm-w.com/games/quordle/'),
    );
    expect(v).toMatchObject({ puzzleNumber: 1727, solved: true, attempts: 8, score: 24 });
    expect(v.details.boards).toEqual([5, 7, 8, 4]);
    const lost = expectOk(parse('quordle', '🙂 Daily Quordle 1726\n6️⃣🟥\n9️⃣8️⃣'));
    expect(lost).toMatchObject({ solved: false, attempts: undefined, score: 33 });
  });

  it('rejects duplicate solves, other modes and bad rows', () => {
    expectErr(parse('quordle', '🙂 Daily Quordle 1727\n5️⃣5️⃣\n8️⃣4️⃣'), 'inconsistent');
    expectErr(parse('quordle', '😎 Daily Chill 1727\n5️⃣7️⃣\n8️⃣4️⃣'), 'not_this_game');
    expectErr(parse('quordle', '🙂 Daily Quordle 1727\n5️⃣7️⃣'), 'malformed');
    expectErr(parse('quordle', '🙂 Daily Quordle 1727\n5️⃣🔟\n8️⃣4️⃣'), 'inconsistent');
  });
});

describe('octordle', () => {
  it('reads boards and checks the score', () => {
    const v = expectOk(
      parse('octordle', 'Daily Octordle #1727\n8️⃣🔟\n7️⃣🕚\n5️⃣6️⃣\n4️⃣9️⃣\nScore: 60'),
    );
    expect(v).toMatchObject({ solved: true, attempts: 11, score: 60 });
    const lost = expectOk(
      parse('octordle', 'Daily Octordle #1726\n🕛🟥\n7️⃣5️⃣\n3️⃣🔟\n🕚🕐\nScore: 75'),
    );
    expect(lost).toMatchObject({ solved: false, score: 75 });
  });

  it('rejects a score that does not match the boards', () => {
    expectErr(
      parse('octordle', 'Daily Octordle #1727\n8️⃣🔟\n7️⃣🕚\n5️⃣6️⃣\n4️⃣9️⃣\nScore: 50'),
      'inconsistent',
    );
    expectErr(
      parse('octordle', 'Daily Sequence Octordle #1727\n8️⃣🔟\n7️⃣🕚\n5️⃣6️⃣\n4️⃣9️⃣'),
      'not_this_game',
    );
  });
});

describe('globle', () => {
  it('reads date and guesses', () => {
    const v = expectOk(
      parse(
        'globle',
        '🌎 Oct 17, 2026 🌍\n🔥 12 | Avg. Guesses: 6.42\n🟨🟧🟥🟥🟩 = 5\n\nhttps://globle-game.com\n#globle',
      ),
    );
    expect(v).toMatchObject({ puzzleDate: '2026-10-17', attempts: 5, solved: true });
  });

  it('rejects mismatched counts and unsolved shares', () => {
    expectErr(
      parse('globle', '🌎 Oct 17, 2026 🌍\n🔥 12 | Avg. Guesses: 6.42\n🟨🟧🟥🟩 = 5'),
      'inconsistent',
    );
    expectErr(parse('globle', '🌎 Oct 17, 2026 🌍\n🔥 0 | Avg. Guesses: --\n-- = --'), 'malformed');
    expectErr(
      parse('globle', '🌎 Oct 19, 2026 🌍\n🔥 1 | Avg. Guesses: 2\n🟥🟩 = 2'),
      'future_puzzle',
    );
  });
});

describe('worldle', () => {
  it('reads number, date and score', () => {
    const v = expectOk(
      parse(
        'worldle',
        '#Worldle #1730 (17.10.2026) 3/6 (100%)\n🟩🟩🟩⬛⬛↗️\n🟩🟩🟩🟩🟨⬅️\n🟩🟩🟩🟩🟩🎉',
      ),
    );
    expect(v).toMatchObject({
      puzzleNumber: 1730,
      puzzleDate: '2026-10-17',
      solved: true,
      attempts: 3,
    });
  });

  it('rejects a date that does not match the number', () => {
    expectErr(parse('worldle', '#Worldle #1730 (16.10.2026) 3/6 (100%)'), 'inconsistent');
  });

  it('rejects grids that disagree with the score', () => {
    expectErr(
      parse(
        'worldle',
        '#Worldle #1730 (17.10.2026) 2/6 (100%)\n🟩🟩🟩⬛⬛↗️\n🟩🟩🟩🟩🟨⬅️\n🟩🟩🟩🟩🟩🎉',
      ),
      'inconsistent',
    );
  });
});

describe('minute cryptic', () => {
  it('counts hints and revealed letters and never stores the clue', () => {
    const v = expectOk(
      parse(
        'minute-cryptic',
        'Minute Cryptic - 17 October, 2026\n"Shy about the start of every new day (5)"\n⚪️🟡🟣🟣🟣🟣\nhttps://www.minutecryptic.com/?utm_source=share',
      ),
    );
    expect(v).toMatchObject({ puzzleDate: '2026-10-17', score: 2 });
    expect(v.details).toMatchObject({ hints: 1, lettersRevealed: 1 });
    expect(v.normalizedShareText).not.toContain('Shy about');
  });

  it('rejects member clues', () => {
    expectErr(
      parse(
        'minute-cryptic',
        'I solved this Minute Cryptic member clue!\nSome clue (5)\nHints: 0, Letters revealed: 0',
      ),
      'not_this_game',
    );
  });
});

describe('nerdle', () => {
  const grid = ['⬛🟪⬛🟪🟪🟩⬛⬛', '🟪⬛🟪🟪⬛🟩⬛⬛', '⬛🟩🟩🟪🟩🟩⬛🟩', '🟩🟩🟩🟩🟩🟩🟩🟩'];
  const share = (header: string, rows = grid) => `${header}\n\n${rows.join('\n')}`;

  it('reads number, attempts and the 8-wide grid', () => {
    const v = expectOk(parse('nerdle', share('nerdlegame 1732 4/6')));
    expect(v).toMatchObject({
      puzzleNumber: 1732,
      puzzleDate: '2026-10-17',
      solved: true,
      attempts: 4,
      maxAttempts: 6,
    });
    expect(v.details.grid).toBe(grid.join('\n'));
  });

  it('handles a failed game', () => {
    const rows = Array.from({ length: 6 }, () => grid[0]!);
    const v = expectOk(parse('nerdle', share('nerdlegame 1731 X/6', rows)));
    expect(v).toMatchObject({ puzzleNumber: 1731, solved: false });
    expect(v.attempts).toBeUndefined();
  });

  it('rejects tampered and malformed grids', () => {
    expectErr(parse('nerdle', share('nerdlegame 1732 3/6')), 'inconsistent');
    expectErr(parse('nerdle', share('nerdlegame 1732 X/6')), 'inconsistent');
    expectErr(
      parse('nerdle', share('nerdlegame 1732 4/6', [...grid.slice(0, 3), '🟩🟩🟩🟩🟩🟩🟩'])),
      'malformed',
    );
  });

  it('rejects future puzzles and other Nerdle variants', () => {
    expectErr(parse('nerdle', share('nerdlegame 1740 4/6')), 'future_puzzle');
    expect(detectParsers('mini nerdlegame 1000 3/6\n🟩🟩🟩🟩🟩🟩')).not.toContain('nerdle');
  });
});

describe('murdle', () => {
  const sample = [
    'THE MYSTERY OF THE CAPRICORN WITH THE BOOBY-TRAPPED FEDORA',
    'Murdle for 10/17/2026',
    '',
    '👤🔪🏡❓     🕰️',
    '✅✅✅✅     2️⃣3️⃣:4️⃣8️⃣',
    '',
    '⚖️',
    '👤',
    '',
    'https://murdle.com',
  ].join('\n');

  it('reads the date, answers and time, and drops the mystery title', () => {
    const v = expectOk(parse('murdle', sample));
    expect(v).toMatchObject({ puzzleDate: '2026-10-17', solved: true, timeSeconds: 23 * 60 + 48 });
    expect(v.details).toMatchObject({ answers: [1, 1, 1, 1], hints: 0 });
    expect(v.normalizedShareText).not.toContain('CAPRICORN');
  });

  it('marks a wrong answer or a wrong accusation as unsolved', () => {
    expect(expectOk(parse('murdle', sample.replace('✅✅✅✅', '✅❌✅✅'))).solved).toBe(false);
    expect(expectOk(parse('murdle', sample.replace('⚖️\n👤', '⚖️\n❌'))).solved).toBe(false);
  });

  it('accepts the older 🟩/⬛ variant with hints', () => {
    const v = expectOk(
      parse('murdle', 'Murdle for 10/16/2026\n\n👤🔪🏡     🕰️\n🟩🟩⬛ 🔮🔮     1️⃣2️⃣:0️⃣5️⃣'),
    );
    expect(v).toMatchObject({ puzzleDate: '2026-10-16', solved: false, timeSeconds: 725 });
    expect(v.details).toMatchObject({ answers: [1, 1, 0], hints: 2 });
  });

  it('rejects bad dates, missing marks and future days', () => {
    expectErr(parse('murdle', sample.replace('10/17/2026', '13/40/2026')), 'malformed');
    expectErr(parse('murdle', 'Murdle for 10/17/2026\n\nno marks here'), 'malformed');
    expectErr(parse('murdle', sample.replace('10/17/2026', '10/25/2026')), 'future_puzzle');
  });
});

describe('clues by sam', () => {
  const sample = [
    'I solved the daily #CluesBySam, Oct 17th 2026 (Tricky), in less than 20 minutes',
    '🟩🟩🟡🟩',
    '🟩🟩🟩🟩',
    '🟩🟠🟩🟩',
    '🟩🟩🟩🟨',
    '🟩🟩🟩🟩',
    'https://cluesbysam.com',
  ].join('\n');

  it('counts errors and hints and reads the difficulty', () => {
    const v = expectOk(parse('clues-by-sam', sample));
    expect(v).toMatchObject({ puzzleDate: '2026-10-17', solved: true, score: 3 });
    expect(v.timeSeconds).toBeUndefined();
    expect(v.details).toMatchObject({
      errors: 1,
      hints: 1,
      secondHints: 1,
      difficulty: 'Tricky',
      underMinutes: 20,
    });
  });

  it('keeps an exact time when the share has one', () => {
    const v = expectOk(parse('clues-by-sam', sample.replace('less than 20 minutes', '05:42')));
    expect(v.timeSeconds).toBe(5 * 60 + 42);
  });

  it('rejects missing grids, bad dates and future days', () => {
    expectErr(parse('clues-by-sam', sample.split('\n')[0]!), 'malformed');
    expectErr(parse('clues-by-sam', sample.replace('Oct 17th', 'Oct 32nd')), 'malformed');
    expectErr(parse('clues-by-sam', sample.replace('Oct 17th', 'Oct 24th')), 'future_puzzle');
  });
});

describe('generic (tier 2)', () => {
  it('extracts number, score and grid and keys the result to today', () => {
    const v = expectOk(
      parse('costcodle', 'Costcodle #612 3/6\n⬆️🟥\n⬇️🟨\n✅\nhttps://costcodle.com'),
    );
    expect(v).toMatchObject({ solved: true, score: 3, maxAttempts: 6, puzzleDate: '2026-10-17' });
    expect(v.details.sharedNumber).toBe(612);
    expect(v.normalizedShareText).not.toContain('https://');
  });

  it('reads waffle-style headers and failures', () => {
    expect(expectOk(parse('waffle', '#waffle1365 4/5')).details.sharedNumber).toBe(1365);
    expect(expectOk(parse('bandle', 'Bandle #1102 x/6')).solved).toBe(false);
  });

  it('uses an explicit archive date', () => {
    expect(expectOk(parse('angle', '#Angle #1020 2/4', { forDate: '2026-10-10' })).puzzleDate).toBe(
      '2026-10-10',
    );
  });

  it('rejects text with nothing to extract and out-of-range scores', () => {
    expectErr(parse('costcodle', 'I had fun today'), 'malformed');
    expectErr(parse('costcodle', 'Costcodle #612 9/6'), 'inconsistent');
  });
});
