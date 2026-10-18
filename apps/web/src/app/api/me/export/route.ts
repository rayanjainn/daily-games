import { NextResponse } from 'next/server';
import {
  asc,
  desc,
  eq,
  follows,
  nativePlays,
  pickDismissals,
  gameNotes,
  games,
  passkeyCredentials,
  results,
  comments,
  communities,
  posts,
  sessions,
  solutions,
} from '@everydaily/shared/db';
import { db } from '@/server/db';
import { query } from '@/server/http';
import { requireSession } from '@/server/session';

/** Everything we store about the signed-in user, as JSON. Secrets (keys, hashes) are left out. */
export const GET = query(async () => {
  const { user } = await requireSession();
  const [
    passkeys,
    sessionRows,
    followRows,
    resultRows,
    noteRows,
    solutionRows,
    postRows,
    commentRows,
    dismissedRows,
    nativeRows,
  ] = await Promise.all([
    db()
      .select({
        nickname: passkeyCredentials.nickname,
        createdAt: passkeyCredentials.createdAt,
        lastUsedAt: passkeyCredentials.lastUsedAt,
      })
      .from(passkeyCredentials)
      .where(eq(passkeyCredentials.userId, user.id)),
    db()
      .select({
        method: sessions.method,
        createdAt: sessions.createdAt,
        lastSeenAt: sessions.lastSeenAt,
        revokedAt: sessions.revokedAt,
      })
      .from(sessions)
      .where(eq(sessions.userId, user.id))
      .orderBy(desc(sessions.createdAt)),
    db()
      .select({ game: games.slug, since: follows.createdAt })
      .from(follows)
      .innerJoin(games, eq(games.id, follows.gameId))
      .where(eq(follows.userId, user.id)),
    db()
      .select({
        game: games.slug,
        puzzleNumber: results.puzzleNumber,
        puzzleDate: results.puzzleDate,
        solved: results.solved,
        attempts: results.attempts,
        timeSeconds: results.timeSeconds,
        score: results.score,
        source: results.source,
        fromArchive: results.fromArchive,
        shareText: results.rawShareText,
        loggedAt: results.createdAt,
      })
      .from(results)
      .innerJoin(games, eq(games.id, results.gameId))
      .where(eq(results.userId, user.id))
      .orderBy(asc(results.puzzleDate)),
    db()
      .select({ game: games.slug, body: gameNotes.body, updatedAt: gameNotes.updatedAt })
      .from(gameNotes)
      .innerJoin(games, eq(games.id, gameNotes.gameId))
      .where(eq(gameNotes.userId, user.id)),
    db()
      .select({
        game: games.slug,
        puzzleDate: solutions.puzzleDate,
        body: solutions.body,
        sourceUrl: solutions.sourceUrl,
        status: solutions.status,
        sharedAt: solutions.createdAt,
      })
      .from(solutions)
      .innerJoin(games, eq(games.id, solutions.gameId))
      .where(eq(solutions.authorId, user.id)),
    db()
      .select({
        community: communities.slug,
        title: posts.title,
        body: posts.bodyMd,
        status: posts.status,
        postedAt: posts.createdAt,
      })
      .from(posts)
      .innerJoin(communities, eq(communities.id, posts.communityId))
      .where(eq(posts.authorId, user.id)),
    db()
      .select({
        postId: comments.postId,
        body: comments.bodyMd,
        status: comments.status,
        postedAt: comments.createdAt,
      })
      .from(comments)
      .where(eq(comments.authorId, user.id)),
    db()
      .select({ game: games.slug, dismissedAt: pickDismissals.createdAt })
      .from(pickDismissals)
      .innerJoin(games, eq(games.id, pickDismissals.gameId))
      .where(eq(pickDismissals.userId, user.id)),
    db()
      .select({
        game: games.slug,
        puzzleNumber: nativePlays.puzzleNumber,
        startedAt: nativePlays.startedAt,
        finishedAt: nativePlays.finishedAt,
        state: nativePlays.state,
      })
      .from(nativePlays)
      .innerJoin(games, eq(games.id, nativePlays.gameId))
      .where(eq(nativePlays.userId, user.id)),
  ]);
  const data = {
    exportedAt: new Date().toISOString(),
    account: {
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      timezone: user.timezone,
      createdAt: user.createdAt,
      recoveryPhraseConfirmed: Boolean(user.recoveryConfirmedAt),
    },
    passkeys,
    sessions: sessionRows,
    follows: followRows,
    results: resultRows,
    notes: noteRows,
    solutions: solutionRows,
    posts: postRows,
    comments: commentRows,
    dismissedPicks: dismissedRows,
    nativePlays: nativeRows,
  };
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'content-type': 'application/json',
      'content-disposition': `attachment; filename="everydaily-${user.username}.json"`,
      'cache-control': 'no-store',
    },
  });
});
