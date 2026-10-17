import 'server-only';
import { and, desc, eq, results, type Game } from '@everydaily/shared/db';
import { clockFromGame } from '@everydaily/shared/registry';
import { formatResult } from '@everydaily/shared/stats/format';
import { archiveDays, type ArchiveDay } from '@everydaily/shared/stats/archive';
import { buildHeatmap, type HeatDay } from '@everydaily/shared/stats/heatmap';
import { computeGameStats, type GameStats } from '@everydaily/shared/stats/summary';
import { currentPuzzle } from '@everydaily/shared/time/puzzle';
import { db } from './db';

export interface HistoryRow {
  id: string;
  puzzleNumber: number | null;
  puzzleDate: string;
  summary: string;
  solved: boolean;
  source: string;
  fromArchive: boolean;
}

export interface GameStatsView {
  stats: GameStats;
  heatmap: HeatDay[][];
  history: HistoryRow[];
  /** Recent puzzles for the archive tracker (empty when the player hasn't started the game). */
  archive: ArchiveDay[];
}

/** One player's stats for one game, computed from their results (the source of truth). */
export async function getGameStats(
  user: { id: string; timezone: string },
  game: Game,
  followed: Date | null,
  now = new Date(),
): Promise<GameStatsView> {
  const rows = await db()
    .select({
      id: results.id,
      puzzleNumber: results.puzzleNumber,
      puzzleDate: results.puzzleDate,
      solved: results.solved,
      attempts: results.attempts,
      maxAttempts: results.maxAttempts,
      timeSeconds: results.timeSeconds,
      score: results.score,
      source: results.source,
      fromArchive: results.fromArchive,
    })
    .from(results)
    .where(and(eq(results.userId, user.id), eq(results.gameId, game.id)))
    .orderBy(desc(results.puzzleNumber));

  const clock = clockFromGame(game);
  const today = currentPuzzle(clock, now, user.timezone);
  // The tracker starts at whichever came first: following the game or the first result.
  const starts = [
    ...(followed ? [currentPuzzle(clock, followed, user.timezone).number] : []),
    ...(rows.length ? [rows[rows.length - 1]!.puzzleNumber] : []),
  ];
  const archive = starts.length
    ? archiveDays(
        clock,
        today.number,
        Math.min(...starts),
        new Map(
          rows.map((r) => [r.puzzleNumber, { solved: r.solved, fromArchive: r.fromArchive }]),
        ),
      )
    : [];
  const scoring = { type: game.scoringType, maxAttempts: game.maxAttempts, unit: game.scoringUnit };
  return {
    stats: computeGameStats(rows, scoring, today.number),
    heatmap: buildHeatmap(
      rows.map((r) => ({ date: r.puzzleDate, solved: r.solved })),
      today.date,
      26,
    ),
    history: rows.slice(0, 30).map((r) => ({
      id: r.id,
      puzzleNumber: game.numberingPublic ? r.puzzleNumber : null,
      puzzleDate: r.puzzleDate,
      summary: formatResult(r, { type: game.scoringType, unit: game.scoringUnit }),
      solved: r.solved,
      source: r.source,
      fromArchive: r.fromArchive,
    })),
    archive,
  };
}
