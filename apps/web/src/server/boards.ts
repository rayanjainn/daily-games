import 'server-only';
import { and, games, gte, inArray, results, type Game } from '@everydaily/shared/db';
import { clockFromGame } from '@everydaily/shared/registry';
import {
  rankDay,
  rankWeek,
  type RankedEntry,
  type WeekRow,
} from '@everydaily/shared/stats/leaderboard';
import { currentPuzzle } from '@everydaily/shared/time/puzzle';
import { addDays, localDate } from '@everydaily/shared/time/zoned';
import { db } from './db';

export interface Board {
  /** Games the players played this week, most played first. */
  games: { slug: string; name: string; plays: number }[];
  game: { slug: string; name: string; puzzleLabel: string } | null;
  today: RankedEntry[];
  /** Viewer hasn't logged today's puzzle and is spoiler-safe: scores are hidden. */
  hidden: boolean;
  week: (WeekRow & { rank: number })[];
}

const label = (g: Game, n: number, date: string) =>
  g.numberingPublic
    ? `#${n.toLocaleString('en-US')}`
    : new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      });

/**
 * Boards for a set of players (a group, or the viewer and their friends): today for one game
 * (the chosen one, else the week's most played) and the week across every game. Puzzle numbers
 * follow the viewer's clock.
 */
export async function playerBoard(
  viewer: { id: string; timezone: string; spoilerSafe: boolean },
  players: { id: string; name: string }[],
  slug: string | null,
  now = new Date(),
): Promise<Board> {
  const ids = players.map((m) => m.id);
  const since = addDays(localDate(now, viewer.timezone), -6);
  const week = ids.length
    ? await db()
        .select({
          userId: results.userId,
          gameId: results.gameId,
          puzzleNumber: results.puzzleNumber,
          solved: results.solved,
          attempts: results.attempts,
          maxAttempts: results.maxAttempts,
          timeSeconds: results.timeSeconds,
          score: results.score,
        })
        .from(results)
        .where(and(inArray(results.userId, ids), gte(results.puzzleDate, since)))
    : [];
  const plays = new Map<string, number>();
  for (const r of week) plays.set(r.gameId, (plays.get(r.gameId) ?? 0) + 1);
  const gameRows = plays.size
    ? await db()
        .select()
        .from(games)
        .where(inArray(games.id, [...plays.keys()]))
    : [];
  const gameList = gameRows
    .map((g) => ({ g, plays: plays.get(g.id) ?? 0 }))
    .sort((a, b) => b.plays - a.plays || a.g.name.localeCompare(b.g.name));
  const chosen =
    (slug ? gameList.find((x) => x.g.slug === slug) : undefined)?.g ?? gameList[0]?.g ?? null;

  let today: RankedEntry[] = [];
  let hidden = false;
  let game: Board['game'] = null;
  if (chosen) {
    const p = currentPuzzle(clockFromGame(chosen), now, viewer.timezone);
    const todays = week.filter((r) => r.gameId === chosen.id && r.puzzleNumber === p.number);
    hidden = viewer.spoilerSafe && !todays.some((r) => r.userId === viewer.id);
    today = rankDay(
      players.map((m) => ({
        userId: m.id,
        name: m.name,
        result: todays.find((r) => r.userId === m.id) ?? null,
      })),
      chosen.scoringType,
      { hideScores: hidden, viewerId: viewer.id },
    );
    game = { slug: chosen.slug, name: chosen.name, puzzleLabel: label(chosen, p.number, p.date) };
  }

  const weekRows = players.map((m) => {
    const mine = week.filter((r) => r.userId === m.id);
    return {
      userId: m.id,
      name: m.name,
      played: mine.length,
      solved: mine.filter((r) => r.solved).length,
    };
  });

  return {
    games: gameList.map(({ g, plays: n }) => ({ slug: g.slug, name: g.name, plays: n })),
    game,
    today,
    hidden,
    week: rankWeek(weekRows),
  };
}
