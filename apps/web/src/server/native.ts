import 'server-only';
import { createHmac } from 'node:crypto';
import { z } from 'zod';
import {
  and,
  eq,
  nativePlays,
  results,
  users,
  type Game,
  type NativePlay,
} from '@everydaily/shared/db';
import {
  CIPHER_MAX_GUESSES,
  CIPHER_SYMBOLS,
  SCRAMBLE_WORDS,
  checkMakeIt,
  cipherCode,
  cipherFeedback,
  cipherShare,
  isCracked,
  isScrambleSolution,
  makeItPuzzle,
  makeItShare,
  rngFromBytes,
  scrambleCandidates,
  scramblePuzzle,
  scrambleShare,
  type CipherFeedback,
} from '@everydaily/shared/native';
import { clockFromGame } from '@everydaily/shared/registry';
import { formatResult } from '@everydaily/shared/stats/format';
import { rankDay } from '@everydaily/shared/stats/leaderboard';
import { currentPuzzle } from '@everydaily/shared/time/puzzle';
import { BIP39_ENGLISH } from './auth/wordlists/bip39';
import { db } from './db';
import { env } from './env';
import { HttpError } from './session';
import { refreshStreak } from './results';

export const NATIVE_SLUGS = ['cipher', 'scramble', 'make-it'] as const;
export type NativeSlug = (typeof NATIVE_SLUGS)[number];
export const isNativeSlug = (s: string): s is NativeSlug =>
  (NATIVE_SLUGS as readonly string[]).includes(s);

/** Longest a timed game can record; the clock runs from when the puzzle is first opened. */
const MAX_SECONDS = 5999;

const WORDS = scrambleCandidates(BIP39_ENGLISH);
const WORD_SET: ReadonlySet<string> = new Set(WORDS);

/**
 * The day's puzzle is a pure function of a key only the server has, so nobody can work out
 * tomorrow's (or today's) answer from the open-source code.
 */
function rngFor(slug: NativeSlug, puzzleNumber: number) {
  const bytes = createHmac('sha256', env('core').AUTH_SECRET)
    .update(`native:v1:${slug}:${puzzleNumber}`)
    .digest();
  return rngFromBytes(new Uint8Array(bytes));
}

export const moveSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('guess'),
      guess: z
        .array(
          z
            .number()
            .int()
            .min(0)
            .max(CIPHER_SYMBOLS - 1),
        )
        .length(4),
    })
    .strict(),
  z
    .object({
      action: z.literal('word'),
      index: z
        .number()
        .int()
        .min(0)
        .max(SCRAMBLE_WORDS - 1),
      guess: z.string().trim().min(1).max(12),
    })
    .strict(),
  z.object({ action: z.literal('expression'), expression: z.string().max(120) }).strict(),
]);
export type Move = z.infer<typeof moveSchema>;

// ---- what the player is shown ---------------------------------------------------------------

interface Common {
  puzzleNumber: number;
  startedAt: string;
  finished: boolean;
  solved: boolean;
  /** Set once the game is over. */
  result: { summary: string; shareText: string; timeSeconds: number | null } | null;
}
export type CipherView = Common & {
  kind: 'cipher';
  maxGuesses: number;
  guesses: ({ guess: number[] } & CipherFeedback)[];
  /** Revealed only when the player ran out of guesses. */
  code: number[] | null;
};
export type ScrambleView = Common & {
  kind: 'scramble';
  scrambled: string[];
  /** The words found so far, by position. */
  solvedWords: (string | null)[];
};
export type MakeItView = Common & {
  kind: 'make-it';
  numbers: number[];
  target: number;
  tries: number;
  expression: string | null;
};
export type NativeView = CipherView | ScrambleView | MakeItView;

interface CipherState {
  guesses?: number[][];
}
interface ScrambleState {
  solved?: (string | null)[];
}
interface MakeItState {
  tries?: number;
  expression?: string;
}

async function playFor(userId: string, game: Game, puzzleNumber: number): Promise<NativePlay> {
  await db()
    .insert(nativePlays)
    .values({ userId, gameId: game.id, puzzleNumber })
    .onConflictDoNothing();
  const [row] = await db()
    .select()
    .from(nativePlays)
    .where(
      and(
        eq(nativePlays.userId, userId),
        eq(nativePlays.gameId, game.id),
        eq(nativePlays.puzzleNumber, puzzleNumber),
      ),
    );
  return row!;
}

async function resultFor(userId: string, game: Game, puzzleNumber: number) {
  const [r] = await db()
    .select()
    .from(results)
    .where(
      and(
        eq(results.userId, userId),
        eq(results.gameId, game.id),
        eq(results.puzzleNumber, puzzleNumber),
      ),
    );
  if (!r) return null;
  return {
    summary: formatResult(
      {
        solved: r.solved,
        attempts: r.attempts,
        maxAttempts: r.maxAttempts,
        timeSeconds: r.timeSeconds,
        score: r.score,
      },
      { type: game.scoringType, unit: game.scoringUnit },
    ),
    shareText: r.rawShareText ?? '',
    timeSeconds: r.timeSeconds,
    solved: r.solved,
  };
}

function viewOf(
  slug: NativeSlug,
  puzzleNumber: number,
  play: NativePlay,
  result: Awaited<ReturnType<typeof resultFor>>,
): NativeView {
  const common: Common = {
    puzzleNumber,
    startedAt: play.startedAt.toISOString(),
    finished: Boolean(play.finishedAt),
    solved: result?.solved ?? false,
    result: result
      ? { summary: result.summary, shareText: result.shareText, timeSeconds: result.timeSeconds }
      : null,
  };
  const rng = rngFor(slug, puzzleNumber);
  if (slug === 'cipher') {
    const code = cipherCode(rng);
    const guesses = ((play.state as CipherState).guesses ?? []).map((guess) => ({
      guess,
      ...cipherFeedback(code, guess),
    }));
    return {
      ...common,
      kind: 'cipher',
      maxGuesses: CIPHER_MAX_GUESSES,
      guesses,
      code: common.finished && !common.solved ? code : null,
    };
  }
  if (slug === 'scramble') {
    const p = scramblePuzzle(rng, WORDS);
    const solvedWords =
      (play.state as ScrambleState).solved ?? Array<string | null>(SCRAMBLE_WORDS).fill(null);
    return { ...common, kind: 'scramble', scrambled: p.scrambled, solvedWords };
  }
  const p = makeItPuzzle(rng);
  const s = play.state as MakeItState;
  return {
    ...common,
    kind: 'make-it',
    numbers: p.numbers,
    target: p.target,
    tries: s.tries ?? 0,
    expression: s.expression ?? null,
  };
}

/** The puzzle for the player's today. Opening it starts the clock for timed games. */
export async function nativeView(
  user: { id: string; timezone: string },
  game: Game,
): Promise<NativeView> {
  const slug = nativeSlugOf(game);
  const { number } = currentPuzzle(clockFromGame(game), new Date(), user.timezone);
  const play = await playFor(user.id, game, number);
  return viewOf(
    slug,
    number,
    play,
    play.finishedAt ? await resultFor(user.id, game, number) : null,
  );
}

function nativeSlugOf(game: Game): NativeSlug {
  if (game.embedMode !== 'native' || !isNativeSlug(game.slug))
    throw new HttpError(404, 'not_found', 'This game is not played here.');
  return game.slug;
}

// ---- moves ----------------------------------------------------------------------------------

type Tx = Parameters<Parameters<ReturnType<typeof db>['transaction']>[0]>[0];

/** Saves the finished game as a result (once) and closes the play. */
async function finish(
  tx: Tx,
  user: { id: string; timezone: string },
  game: Game,
  play: NativePlay,
  outcome: {
    solved: boolean;
    attempts?: number;
    timeSeconds?: number;
    shareText: string;
    details: Record<string, unknown>;
  },
) {
  const { date } = currentPuzzle(clockFromGame(game), new Date(), user.timezone);
  await tx
    .insert(results)
    .values({
      userId: user.id,
      gameId: game.id,
      puzzleNumber: play.puzzleNumber,
      puzzleDate: date,
      solved: outcome.solved,
      attempts: outcome.attempts ?? null,
      maxAttempts: game.scoringType === 'attempts' ? game.maxAttempts : null,
      timeSeconds: outcome.timeSeconds ?? null,
      score: null,
      details: { native: true, ...outcome.details },
      rawShareText: outcome.shareText,
      source: 'native',
      fromArchive: false,
    })
    .onConflictDoNothing({ target: [results.userId, results.gameId, results.puzzleNumber] });
  await tx.update(nativePlays).set({ finishedAt: new Date() }).where(eq(nativePlays.id, play.id));
}

const elapsedSeconds = (play: NativePlay) =>
  Math.min(MAX_SECONDS, Math.max(1, Math.round((Date.now() - play.startedAt.getTime()) / 1000)));

/**
 * Applies one move to today's puzzle and returns the new view. Everything is checked here: the
 * client never has the answer, and a finished puzzle takes no more moves.
 */
export async function nativeMove(
  user: { id: string; timezone: string },
  game: Game,
  move: Move,
): Promise<NativeView> {
  const slug = nativeSlugOf(game);
  const { number } = currentPuzzle(clockFromGame(game), new Date(), user.timezone);
  await playFor(user.id, game, number);
  const rng = rngFor(slug, number);

  const done = await db().transaction(async (tx) => {
    // One move at a time per puzzle, so quick double taps can't both count.
    const [play] = await tx
      .select()
      .from(nativePlays)
      .where(
        and(
          eq(nativePlays.userId, user.id),
          eq(nativePlays.gameId, game.id),
          eq(nativePlays.puzzleNumber, number),
        ),
      )
      .for('update');
    if (!play) throw new HttpError(404, 'not_found', 'Puzzle not found.');
    if (play.finishedAt)
      throw new HttpError(409, 'finished', 'You already finished today’s puzzle.');
    const save = (state: Record<string, unknown>) =>
      tx.update(nativePlays).set({ state }).where(eq(nativePlays.id, play.id));
    let finished = false;

    if (slug === 'cipher') {
      if (move.action !== 'guess') throw wrongMove();
      const code = cipherCode(rng);
      const guesses = [...((play.state as CipherState).guesses ?? []), move.guess];
      const rows = guesses.map((g) => cipherFeedback(code, g));
      const solved = isCracked(rows[rows.length - 1]!);
      await save({ guesses });
      if (solved || guesses.length >= CIPHER_MAX_GUESSES) {
        finished = true;
        await finish(tx, user, game, play, {
          solved,
          attempts: solved ? guesses.length : CIPHER_MAX_GUESSES,
          shareText: cipherShare(number, guesses.length, solved, rows),
          details: { guesses: guesses.length },
        });
      }
    } else if (slug === 'scramble') {
      if (move.action !== 'word') throw wrongMove();
      const p = scramblePuzzle(rng, WORDS);
      const solved = [
        ...((play.state as ScrambleState).solved ??
          Array<string | null>(SCRAMBLE_WORDS).fill(null)),
      ];
      if (solved[move.index])
        throw new HttpError(409, 'already_solved', 'You already have that word.');
      if (!isScrambleSolution(p.scrambled[move.index]!, move.guess, WORD_SET))
        throw new HttpError(422, 'wrong_word', 'Not a word that fits those letters.');
      solved[move.index] = move.guess.trim().toLowerCase();
      await save({ solved });
      if (solved.every(Boolean)) {
        finished = true;
        const seconds = elapsedSeconds(play);
        await finish(tx, user, game, play, {
          solved: true,
          timeSeconds: seconds,
          shareText: scrambleShare(number, seconds),
          details: {},
        });
      }
    } else {
      if (move.action !== 'expression') throw wrongMove();
      const p = makeItPuzzle(rng);
      const check = checkMakeIt(p, move.expression);
      const state = play.state as MakeItState;
      if (!check.ok) {
        await save({ ...state, tries: (state.tries ?? 0) + 1 });
        throw new HttpError(422, 'wrong_answer', check.message, { reason: check.reason });
      }
      await save({ ...state, tries: (state.tries ?? 0) + 1, expression: move.expression.trim() });
      finished = true;
      const seconds = elapsedSeconds(play);
      await finish(tx, user, game, play, {
        solved: true,
        timeSeconds: seconds,
        shareText: makeItShare(number, seconds),
        details: { tries: (state.tries ?? 0) + 1 },
      });
    }
    return finished;
  });

  if (done) await refreshStreak(user.id, game, user.timezone);
  return nativeView(user, game);
}

const wrongMove = () => new HttpError(400, 'invalid_input', 'That move is not part of this game.');

// ---- the global board -----------------------------------------------------------------------

export interface GlobalBoardRow {
  rank: number;
  name: string;
  summary: string;
  me: boolean;
}

/**
 * Today's best results in a native game, from every player who finished it here. Only results
 * the server verified (source "native") are listed, and players can opt out in Settings.
 */
export async function globalBoard(
  viewerId: string,
  game: Game,
  puzzleNumber: number,
  limit = 20,
): Promise<{ rows: GlobalBoardRow[]; players: number }> {
  const rows = await db()
    .select({
      userId: results.userId,
      name: users.displayName,
      username: users.username,
      solved: results.solved,
      attempts: results.attempts,
      maxAttempts: results.maxAttempts,
      timeSeconds: results.timeSeconds,
      score: results.score,
      listed: users.showOnRankings,
    })
    .from(results)
    .innerJoin(users, eq(users.id, results.userId))
    .where(
      and(
        eq(results.gameId, game.id),
        eq(results.puzzleNumber, puzzleNumber),
        eq(results.source, 'native'),
      ),
    );
  const visible = rows.filter((r) => r.listed || r.userId === viewerId);
  const ranked = rankDay(
    visible.map((r) => ({
      userId: r.userId,
      name: r.name ?? r.username,
      result: {
        solved: r.solved,
        attempts: r.attempts,
        maxAttempts: r.maxAttempts,
        timeSeconds: r.timeSeconds,
        score: r.score,
      },
    })),
    game.scoringType,
    { hideScores: false, viewerId },
  );
  const top = ranked.filter((e) => e.rank !== null).slice(0, limit);
  const mine = ranked.find((e) => e.userId === viewerId && e.rank !== null);
  const shown = mine && !top.some((e) => e.userId === viewerId) ? [...top, mine] : top;
  return {
    players: rows.length,
    rows: shown.map((e) => ({
      rank: e.rank!,
      name: e.name,
      summary: e.summary ?? '',
      me: e.userId === viewerId,
    })),
  };
}
