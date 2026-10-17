import 'server-only';
import { z } from 'zod';
import { and, eq, results, streaks, type Game } from '@everydaily/shared/db';
import { MAX_SHARE_TEXT_LENGTH } from '@everydaily/shared/domain';
import { parseShareText, type ParsedResult } from '@everydaily/shared/parsers';
import { clockFromGame } from '@everydaily/shared/registry';
import {
  buildCheckoff,
  buildManualResult,
  manualEntrySchema,
  type EntryGame,
} from '@everydaily/shared/results/entry';
import { formatResult } from '@everydaily/shared/stats/format';
import { computeStreak } from '@everydaily/shared/stats/streak';
import { currentPuzzle } from '@everydaily/shared/time/puzzle';
import { db } from './db';
import { HttpError } from './session';

/**
 * One payload for every way a result arrives. `extension` is reserved for a future browser
 * extension that posts the same share text it captured.
 */
export const logInputSchema = z.discriminatedUnion('source', [
  z
    .object({
      source: z.enum(['paste', 'extension']),
      slug: z.string().max(60),
      shareText: z.string().min(1).max(MAX_SHARE_TEXT_LENGTH),
    })
    .strict(),
  z
    .object({ source: z.literal('manual'), slug: z.string().max(60), entry: manualEntrySchema })
    .strict(),
  z
    .object({
      source: z.literal('checkbox'),
      slug: z.string().max(60),
      puzzleNumber: z.number().int().optional(),
    })
    .strict(),
]);
export type LogInput = z.infer<typeof logInputSchema>;

function entryGame(g: Game): EntryGame {
  return {
    slug: g.slug,
    tier: g.tier,
    clock: clockFromGame(g),
    numberingPublic: g.numberingPublic,
    maxAttempts: g.maxAttempts,
    scoringType: g.scoringType,
  };
}

/** Turns any log payload into a validated result for `game`, or throws a 400/422. */
export function interpret(game: Game, input: LogInput, userTz: string, now = new Date()) {
  const eg = entryGame(game);
  if (input.source === 'paste' || input.source === 'extension') {
    if (!game.parserId)
      throw new HttpError(
        422,
        'no_parser',
        `${game.name} is tracked with a check-off, not a paste.`,
      );
    const out = parseShareText(input.shareText, game.parserId, {
      game: eg,
      now,
      userTimeZone: userTz,
    });
    if (!out.ok) throw new HttpError(422, out.code, out.message);
    return out.value;
  }
  let out;
  if (input.source === 'manual') {
    out = buildManualResult(eg, input.entry, now, userTz);
  } else if (input.source === 'checkbox') {
    if (game.tier !== 3)
      throw new HttpError(422, 'invalid', `Paste your ${game.name} result or enter your score.`);
    out = buildCheckoff(eg, input.puzzleNumber, now, userTz);
  } else {
    throw new HttpError(400, 'invalid_input', 'Unknown result source.');
  }
  if (!out.ok) throw new HttpError(422, out.code, out.message);
  return out.value;
}

export function summarize(game: Pick<Game, 'scoringType' | 'scoringUnit'>, r: ParsedResult) {
  return formatResult(
    {
      solved: r.solved,
      attempts: r.attempts ?? null,
      maxAttempts: r.maxAttempts ?? null,
      timeSeconds: r.timeSeconds ?? null,
      score: r.score ?? null,
    },
    { type: game.scoringType, unit: game.scoringUnit },
  );
}

export async function existingResult(userId: string, gameId: string, puzzleNumber: number) {
  const rows = await db()
    .select()
    .from(results)
    .where(
      and(
        eq(results.userId, userId),
        eq(results.gameId, gameId),
        eq(results.puzzleNumber, puzzleNumber),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/** Recomputes the cached streak row for one game from its results. */
export async function refreshStreak(userId: string, game: Game, userTz: string) {
  const rows = await db()
    .select({ n: results.puzzleNumber })
    .from(results)
    .where(and(eq(results.userId, userId), eq(results.gameId, game.id)));
  const today = currentPuzzle(clockFromGame(game), new Date(), userTz).number;
  const s = computeStreak(
    rows.map((r) => r.n),
    today,
  );
  await db()
    .insert(streaks)
    .values({
      userId,
      gameId: game.id,
      current: s.current,
      best: s.best,
      lastPuzzleNumber: s.last,
    })
    .onConflictDoUpdate({
      target: [streaks.userId, streaks.gameId],
      set: { current: s.current, best: s.best, lastPuzzleNumber: s.last, updatedAt: new Date() },
    });
  return s;
}

/**
 * Saves a result once. A second result for the same puzzle is refused with the one already
 * saved, so a double tap or a re-paste never overwrites a score silently.
 */
export async function saveResult(
  user: { id: string; timezone: string },
  game: Game,
  input: LogInput,
) {
  const r = interpret(game, input, user.timezone);
  const inserted = await db()
    .insert(results)
    .values({
      userId: user.id,
      gameId: game.id,
      puzzleNumber: r.puzzleNumber,
      puzzleDate: r.puzzleDate,
      solved: r.solved,
      attempts: r.attempts ?? null,
      maxAttempts: r.maxAttempts ?? null,
      timeSeconds: r.timeSeconds ?? null,
      score: r.score ?? null,
      details: r.details,
      rawShareText: r.normalizedShareText || null,
      source: input.source,
    })
    .onConflictDoNothing({ target: [results.userId, results.gameId, results.puzzleNumber] })
    .returning({ id: results.id });

  if (!inserted.length) {
    const prev = await existingResult(user.id, game.id, r.puzzleNumber);
    throw new HttpError(409, 'duplicate', 'You already logged this puzzle.', {
      resultId: prev?.id,
      summary: prev
        ? summarize(game, {
            ...r,
            solved: prev.solved,
            attempts: prev.attempts ?? undefined,
            maxAttempts: prev.maxAttempts ?? undefined,
            timeSeconds: prev.timeSeconds ?? undefined,
            score: prev.score ?? undefined,
          })
        : undefined,
    });
  }
  const streak = await refreshStreak(user.id, game, user.timezone);
  return {
    id: inserted[0]!.id,
    puzzleNumber: r.puzzleNumber,
    puzzleDate: r.puzzleDate,
    summary: summarize(game, r),
    solved: r.solved,
    streak,
  };
}
