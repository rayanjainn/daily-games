import 'server-only';
import { cache } from 'react';
import { and, asc, eq, follows, games, ne, type Game } from '@everydaily/shared/db';
import { clockFromGame, type IconKey } from '@everydaily/shared/registry';
import { currentPuzzle } from '@everydaily/shared/time/puzzle';
import { db } from './db';

/** What catalog cards and the game page need; plain JSON so it can cross to client components. */
export interface CatalogGame {
  id: string;
  slug: string;
  name: string;
  publisher: string;
  description: string;
  url: string;
  category: Game['category'];
  difficulty: Game['difficulty'];
  tier: Game['tier'];
  embedMode: Game['embedMode'];
  status: Game['status'];
  tags: string[];
  accentColor: string;
  icon: IconKey;
  scoringType: Game['scoringType'];
  maxAttempts: number | null;
  scoringUnit: string | null;
  /** today's puzzle for this player; the number only when the game shows one */
  today: { date: string; number: number | null };
}

export function toCatalogGame(g: Game, userTz: string, now = new Date()): CatalogGame {
  const p = currentPuzzle(clockFromGame(g), now, userTz);
  return {
    id: g.id,
    slug: g.slug,
    name: g.name,
    publisher: g.publisher,
    description: g.description,
    url: g.url,
    category: g.category,
    difficulty: g.difficulty,
    tier: g.tier,
    embedMode: g.embedMode,
    status: g.status,
    tags: g.tags,
    accentColor: g.accentColor,
    icon: g.icon as IconKey,
    scoringType: g.scoringType,
    maxAttempts: g.maxAttempts,
    scoringUnit: g.scoringUnit,
    today: { date: p.date, number: g.numberingPublic ? p.number : null },
  };
}

/** Every game players can see (archived games are hidden), cached per request. */
export const listGames = cache(async (): Promise<Game[]> =>
  db().select().from(games).where(ne(games.status, 'archived')).orderBy(asc(games.name)),
);

export const getGameBySlug = cache(async (slug: string): Promise<Game | null> => {
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) return null;
  const rows = await db().select().from(games).where(eq(games.slug, slug)).limit(1);
  return rows[0] ?? null;
});

export const followedGameIds = cache(async (userId: string): Promise<Set<string>> => {
  const rows = await db()
    .select({ gameId: follows.gameId })
    .from(follows)
    .where(eq(follows.userId, userId));
  return new Set(rows.map((r) => r.gameId));
});

/** When the player followed the game, or null if they don't follow it. */
export async function followedAt(userId: string, gameId: string): Promise<Date | null> {
  const rows = await db()
    .select({ createdAt: follows.createdAt })
    .from(follows)
    .where(and(eq(follows.userId, userId), eq(follows.gameId, gameId)))
    .limit(1);
  return rows[0]?.createdAt ?? null;
}

/** The attribution line shown on every game page. */
export function attributionLine(publisher: string): string {
  return `Made by ${publisher}. EveryDaily isn't affiliated with ${publisher}; we just help you keep track.`;
}
