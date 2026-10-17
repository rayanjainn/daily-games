import { describe, expect, it } from 'vitest';
import { buildThread, hotScore, placeComment } from './ranking';

describe('hotScore', () => {
  const now = new Date('2026-10-17T12:00:00Z');
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);
  it('lets a fresh post beat an older one with a few more votes', () => {
    expect(hotScore(3, hoursAgo(1), now)).toBeGreaterThan(hotScore(10, hoursAgo(24), now));
  });
  it('ranks by score at the same age', () => {
    expect(hotScore(5, hoursAgo(3), now)).toBeGreaterThan(hotScore(2, hoursAgo(3), now));
  });
});

describe('placeComment', () => {
  it('nests replies and caps the depth', () => {
    expect(placeComment('a', null)).toEqual({ depth: 0, path: 'a', parentPath: null });
    expect(placeComment('b', { path: 'a', depth: 0 })).toEqual({
      depth: 1,
      path: 'a/b',
      parentPath: 'a',
    });
    const deep = { path: 'a/b/c/d/e/f', depth: 5 };
    expect(placeComment('g', deep)).toEqual({
      depth: 5,
      path: 'a/b/c/d/e/g',
      parentPath: 'a/b/c/d/e',
    });
  });
});

describe('buildThread', () => {
  it('turns path-ordered rows into a tree', () => {
    const tree = buildThread([
      { id: 'c', path: 'a/c', depth: 1 },
      { id: 'a', path: 'a', depth: 0 },
      { id: 'b', path: 'b', depth: 0 },
      { id: 'd', path: 'a/c/d', depth: 2 },
      { id: 'x', path: 'gone/x', depth: 1 },
    ]);
    expect(tree.map((n) => n.id)).toEqual(['a', 'b', 'x']);
    expect(tree[0]!.replies[0]!.id).toBe('c');
    expect(tree[0]!.replies[0]!.replies[0]!.id).toBe('d');
  });
});
