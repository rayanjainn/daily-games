import 'server-only';
import { z } from 'zod';
import { and, desc, eq, games, solutions, users, type Game } from '@everydaily/shared/db';
import { MAX_SOLUTION_LENGTH, SOLUTION_WINDOW } from '@everydaily/shared/domain';
import { clockFromGame } from '@everydaily/shared/registry';
import { currentPuzzle, dateForPuzzleNumber } from '@everydaily/shared/time/puzzle';
import { recordModAction } from './catalog/moderation';
import { db } from './db';
import { notify } from './notifications';
import { HttpError } from './session';
import { isPublicHttpsUrl } from './source-url';

export const sourceUrlSchema = z
  .string()
  .trim()
  .max(500, 'Links are limited to 500 characters.')
  .refine(isPublicHttpsUrl, 'Link to a public https page where the answer is published.');

export const solutionInputSchema = z
  .object({
    slug: z.string().max(60),
    puzzleNumber: z.number().int(),
    body: z
      .string()
      .trim()
      .min(1, 'Write the answer.')
      .max(MAX_SOLUTION_LENGTH, `Answers are limited to ${MAX_SOLUTION_LENGTH} characters.`),
    sourceUrl: sourceUrlSchema,
  })
  .strict();

/** The puzzle a player calls "yesterday" for this game, or null before the second puzzle. */
export function yesterdayFor(game: Game, userTz: string, now = new Date()) {
  const clock = clockFromGame(game);
  const n = currentPuzzle(clock, now, userTz).number - 1;
  if (n < game.epochNumber) return null;
  return { number: n, date: dateForPuzzleNumber(clock, n) };
}

/**
 * Saves a solution for review. Only finished puzzles (before the player's current one) in the
 * last week qualify, so nobody can post the answer to a puzzle that is still live for them.
 */
export async function submitSolution(
  user: { id: string; timezone: string },
  game: Game,
  input: z.infer<typeof solutionInputSchema>,
  now = new Date(),
) {
  const clock = clockFromGame(game);
  const today = currentPuzzle(clock, now, user.timezone).number;
  const n = input.puzzleNumber;
  if (n >= today)
    throw new HttpError(
      422,
      'not_finished',
      "Answers can only be shared once a puzzle's day is over.",
    );
  if (n < today - SOLUTION_WINDOW || n < game.epochNumber)
    throw new HttpError(
      422,
      'too_old',
      `Answers can be shared for the last ${SOLUTION_WINDOW} days.`,
    );

  const inserted = await db()
    .insert(solutions)
    .values({
      gameId: game.id,
      puzzleNumber: n,
      puzzleDate: dateForPuzzleNumber(clock, n),
      authorId: user.id,
      body: input.body.replace(/\r\n?/g, '\n'),
      sourceUrl: input.sourceUrl,
    })
    .onConflictDoNothing({ target: [solutions.authorId, solutions.gameId, solutions.puzzleNumber] })
    .returning({ id: solutions.id });
  if (!inserted.length)
    throw new HttpError(409, 'duplicate', 'You already shared an answer for this puzzle.');
  return { id: inserted[0]!.id, status: 'pending' as const };
}

export interface SolutionView {
  puzzleNumber: number | null;
  puzzleDate: string;
  /** For the submit form; always the internal number. */
  puzzleIndex: number;
  approved: { id: string; body: string; sourceUrl: string; author: string }[];
  mine: { status: 'pending' | 'approved' | 'rejected' } | null;
}

/** Approved answers for the player's "yesterday", plus the state of their own submission. */
export async function yesterdaysSolutions(
  user: { id: string; timezone: string },
  game: Game,
  now = new Date(),
): Promise<SolutionView | null> {
  const y = yesterdayFor(game, user.timezone, now);
  if (!y) return null;
  const rows = await db()
    .select({
      id: solutions.id,
      body: solutions.body,
      sourceUrl: solutions.sourceUrl,
      status: solutions.status,
      authorId: solutions.authorId,
      author: users.username,
    })
    .from(solutions)
    .innerJoin(users, eq(users.id, solutions.authorId))
    .where(and(eq(solutions.gameId, game.id), eq(solutions.puzzleNumber, y.number)))
    .orderBy(desc(solutions.decidedAt))
    .limit(50);
  const mine = rows.find((r) => r.authorId === user.id);
  return {
    puzzleNumber: game.numberingPublic ? y.number : null,
    puzzleDate: y.date,
    puzzleIndex: y.number,
    approved: rows
      .filter((r) => r.status === 'approved')
      .slice(0, 3)
      .map(({ id, body, sourceUrl, author }) => ({ id, body, sourceUrl, author })),
    mine: mine ? { status: mine.status } : null,
  };
}

export const solutionDecisionSchema = z
  .object({
    decision: z.enum(['approve', 'reject']),
    reason: z.string().trim().max(300).optional(),
  })
  .strict();

export async function decideSolution(
  actorId: string,
  id: string,
  d: z.infer<typeof solutionDecisionSchema>,
) {
  return db()
    .transaction(async (tx) => {
      const [s] = await tx.select().from(solutions).where(eq(solutions.id, id)).for('update');
      if (!s) throw new HttpError(404, 'not_found', 'Solution not found.');
      if (s.status !== 'pending') throw new HttpError(409, 'already_decided', 'Already handled.');
      const status = d.decision === 'approve' ? 'approved' : 'rejected';
      await tx
        .update(solutions)
        .set({ status, decidedBy: actorId, decidedAt: new Date() })
        .where(eq(solutions.id, id));
      await recordModAction(tx, {
        actorId,
        action: `solution.${d.decision}`,
        targetType: 'solution',
        targetId: id,
        reason: d.reason,
        before: { status: s.status },
        after: { status },
      });
      return s;
    })
    .then(async (s) => {
      await notify(
        s.authorId,
        {
          kind: 'solution',
          title:
            d.decision === 'approve'
              ? 'Your solution was approved and is now visible'
              : 'Your solution was not approved',
          body: d.decision === 'reject' ? d.reason : undefined,
          url: '/games',
        },
        actorId,
      );
    });
}

/** Pending solutions for the moderation queue, oldest first. */
export async function pendingSolutions() {
  return db()
    .select({
      id: solutions.id,
      body: solutions.body,
      sourceUrl: solutions.sourceUrl,
      puzzleNumber: solutions.puzzleNumber,
      puzzleDate: solutions.puzzleDate,
      createdAt: solutions.createdAt,
      game: { slug: games.slug, name: games.name, numberingPublic: games.numberingPublic },
      author: users.username,
    })
    .from(solutions)
    .innerJoin(games, eq(games.id, solutions.gameId))
    .innerJoin(users, eq(users.id, solutions.authorId))
    .where(eq(solutions.status, 'pending'))
    .orderBy(solutions.createdAt)
    .limit(100);
}
