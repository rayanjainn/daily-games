import { describe, expect, it } from 'vitest';
import { glowPuzzle, glowShare, isDark, par, playGlow, tap, GLOW_N } from './glow';
import { rngFromBytes, seedFromString } from './rng';
import { checkSixes, countSolutions, sixesPuzzle, sixesShare, SIXES_N } from './sixes';

const rng = (s: string) => rngFromBytes(seedFromString(s));

describe('Sixes', () => {
  it('makes a valid grid with exactly one solution, the same for the same seed', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const p = sixesPuzzle(rng(seed));
      expect(p.givens).toHaveLength(36);
      expect(countSolutions(p.givens)).toBe(1);
      expect(p.givens.filter(Boolean).length).toBeLessThanOrEqual(20);
      const rows = [...Array(SIXES_N).keys()].map((r) => p.solution.slice(r * 6, r * 6 + 6));
      for (const row of rows) expect([...row].sort()).toEqual([1, 2, 3, 4, 5, 6]);
      for (let c = 0; c < 6; c++) expect(new Set(rows.map((r) => r[c])).size).toBe(6);
      for (let br = 0; br < 6; br += 2)
        for (let bc = 0; bc < 6; bc += 3) {
          const box = [0, 1].flatMap((y) => [0, 1, 2].map((x) => rows[br + y]![bc + x]));
          expect(new Set(box).size).toBe(6);
        }
      p.givens.forEach((v, i) => v && expect(v).toBe(p.solution[i]));
    }
    expect(sixesPuzzle(rng('same')).givens).toEqual(sixesPuzzle(rng('same')).givens);
  });

  it('checks a submitted grid', () => {
    const p = sixesPuzzle(rng('check'));
    expect(checkSixes(p, p.solution)).toEqual({ ok: true });
    expect(checkSixes(p, p.givens)).toMatchObject({ ok: false, reason: 'incomplete' });
    const wrong = [...p.solution];
    const free = p.givens.findIndex((v) => v === 0);
    const other = p.givens.findIndex(
      (v, i) => v === 0 && i !== free && p.solution[i] !== p.solution[free],
    );
    [wrong[free], wrong[other]] = [wrong[other]!, wrong[free]!];
    expect(checkSixes(p, wrong)).toMatchObject({ ok: false, reason: 'wrong', wrongCells: 2 });
    const tampered = [...p.solution];
    const given = p.givens.findIndex(Boolean);
    tampered[given] = (tampered[given]! % 6) + 1;
    expect(checkSixes(p, tampered)).toMatchObject({ ok: false, reason: 'givens' });
  });

  it('shares only the time and the checks used', () => {
    expect(sixesShare(12, 95, 2)).toBe('Sixes 12 1:35\n🟥🟩');
    expect(sixesShare(12, null, 3)).toBe('Sixes 12 X\n🟥🟥🟥');
  });
});

describe('Glow', () => {
  it('taps flip a light and its neighbours, at the edges too', () => {
    const b = tap(Array(25).fill(false), 0);
    expect(b.filter(Boolean)).toHaveLength(3);
    expect(tap(b, 0).every((v) => !v)).toBe(true);
    expect(tap(Array(25).fill(false), 12).filter(Boolean)).toHaveLength(5);
  });

  it('makes solvable boards and finds par', () => {
    for (const seed of ['g1', 'g2', 'g3', 'g4']) {
      const p = glowPuzzle(rng(seed));
      expect(isDark(p.board)).toBe(false);
      expect(p.board).toHaveLength(GLOW_N * GLOW_N);
      expect(p.par).toBeGreaterThanOrEqual(5);
      expect(par(p.board)).toBe(p.par);
    }
  });

  it('replays taps and accepts any route to a dark board', () => {
    let board = Array(25).fill(false);
    for (const i of [3, 7, 18]) board = tap(board, i);
    const p = { board, par: par(board)! };
    expect(p.par).toBeLessThanOrEqual(3);
    expect(playGlow(p, [3, 7, 18])).toBe(true);
    expect(playGlow(p, [18, 3, 7, 0, 0])).toBe(true);
    expect(playGlow(p, [3, 7])).toBe(false);
    expect(playGlow(p, [99])).toBe(false);
    expect(playGlow(p, Array(31).fill(0))).toBe(false);
  });

  it('shares taps against par', () => {
    expect(glowShare(4, 7, 7)).toBe('Glow 4 7 taps (on par)\n💡💡💡💡💡💡💡');
    expect(glowShare(4, 9, 7)).toMatch(/par \+2/);
  });
});
