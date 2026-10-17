import type { GameCategory } from '../domain';

export interface Candidate {
  id: string;
  name: string;
  category: GameCategory;
  /** Players following it. */
  followers: number;
  /** Of those, the viewer's friends. */
  friendFollowers: number;
}

export type PickReason =
  | { kind: 'friends'; count: number }
  | { kind: 'category'; category: GameCategory }
  | { kind: 'popular' };

/**
 * Games to suggest to a player, best first. Friends following a game count most, then games in
 * categories the player already follows, then overall popularity. Each pick says why, using
 * its strongest reason. Candidates must already exclude games the player follows.
 */
export function recommend(
  candidates: Candidate[],
  followedCategories: GameCategory[],
  limit = 4,
): { id: string; reason: PickReason }[] {
  const liked = new Map<GameCategory, number>();
  for (const c of followedCategories) liked.set(c, (liked.get(c) ?? 0) + 1);
  return candidates
    .map((c) => {
      const cat = Math.min(liked.get(c.category) ?? 0, 3);
      // Popularity is a tiebreaker of sorts: halved, and on a log scale.
      const score = c.friendFollowers * 5 + cat * 2 + Math.log2(1 + c.followers) / 2;
      const reason: PickReason =
        c.friendFollowers > 0
          ? { kind: 'friends', count: c.friendFollowers }
          : cat > 0
            ? { kind: 'category', category: c.category }
            : { kind: 'popular' };
      return { c, score, reason };
    })
    .sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name))
    .slice(0, limit)
    .map(({ c, reason }) => ({ id: c.id, reason }));
}
