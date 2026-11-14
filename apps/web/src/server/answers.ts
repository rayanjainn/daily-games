import 'server-only';
import { ANSWER_SOURCES, answerSchema, type Answer } from '@everydaily/shared/answers';
import { and, eq, officialAnswers, results, type Game } from '@everydaily/shared/db';
import { clockFromGame } from '@everydaily/shared/registry';
import { puzzleNumberForDate } from '@everydaily/shared/time/puzzle';
import { db } from './db';
import { env } from './env';
import { log } from './log';
import { redis } from './redis';
import { HttpError } from './session';

export interface RevealedAnswer {
  answer: Answer;
  puzzleDate: string;
  source: { label: string; url: string };
}

const MISS_SECONDS = 10 * 60;

/** True when this game's publisher makes answers available and the feature is on. */
export function answersAvailable(slug: string): boolean {
  return env('features').FEATURE_OFFICIAL_ANSWERS === '1' && slug in ANSWER_SOURCES;
}

async function getFromPublisher(url: string, as: 'json' | 'text'): Promise<unknown | null> {
  const res = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; EveryDaily/1.0; answer reveal after play)',
      accept: as === 'json' ? 'application/json' : 'text/html',
    },
    signal: AbortSignal.timeout(6000),
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const body = as === 'json' ? await res.json().catch(() => null) : await res.text();
  return body;
}

/**
 * The publisher's answer for one puzzle, for a player who has logged it (solved or not).
 * Answers are fetched once per game and date and kept; a failed fetch is not retried for a few
 * minutes, so a broken source isn't hammered.
 */
export async function revealAnswer(
  user: { id: string },
  game: Game,
  puzzleDate: string,
): Promise<RevealedAnswer> {
  const source = answersAvailable(game.slug) ? ANSWER_SOURCES[game.slug] : undefined;
  if (!source) throw new HttpError(404, 'no_source', `${game.name} doesn't publish its answers.`);

  const played = await db()
    .select({ id: results.id })
    .from(results)
    .where(
      and(
        eq(results.userId, user.id),
        eq(results.gameId, game.id),
        eq(results.puzzleDate, puzzleDate),
      ),
    )
    .limit(1);
  if (!played.length)
    throw new HttpError(403, 'play_first', 'Log your result for this puzzle to see the answer.');

  const url = source.pageUrl(puzzleDate);
  const [cached] = await db()
    .select({ answer: officialAnswers.answer, sourceUrl: officialAnswers.sourceUrl })
    .from(officialAnswers)
    .where(and(eq(officialAnswers.gameId, game.id), eq(officialAnswers.puzzleDate, puzzleDate)))
    .limit(1);
  if (cached) {
    const parsed = answerSchema.safeParse(cached.answer);
    if (parsed.success)
      return {
        answer: parsed.data,
        puzzleDate,
        source: { label: source.label, url: cached.sourceUrl },
      };
  }

  const missKey = `answer-miss:${game.slug}:${puzzleDate}`;
  if (await redis().get(missKey))
    throw new HttpError(
      404,
      'not_yet',
      `${source.label} hasn't got an answer for that day right now.`,
    );

  let answer: Answer | null = null;
  try {
    const number = puzzleNumberForDate(clockFromGame(game), puzzleDate);
    const raw = await source.fetch({ date: puzzleDate, number }, getFromPublisher);
    const parsed = answerSchema.safeParse(raw);
    answer = raw && parsed.success ? parsed.data : null;
  } catch (err) {
    log('warn', 'answer fetch failed', { game: game.slug, puzzleDate, error: String(err) });
  }
  if (!answer) {
    await redis().set(missKey, 1, { ex: MISS_SECONDS });
    throw new HttpError(
      404,
      'not_yet',
      `${source.label} hasn't got an answer for that day right now.`,
    );
  }
  await db()
    .insert(officialAnswers)
    .values({ gameId: game.id, puzzleDate, answer, sourceUrl: url })
    .onConflictDoNothing();
  return { answer, puzzleDate, source: { label: source.label, url } };
}
