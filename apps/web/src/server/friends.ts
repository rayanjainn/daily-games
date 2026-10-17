import 'server-only';
import { z } from 'zod';
import {
  and,
  desc,
  eq,
  friendships,
  games,
  gte,
  inArray,
  isNull,
  or,
  results,
  users,
} from '@everydaily/shared/db';
import { clockFromGame } from '@everydaily/shared/registry';
import { formatResult } from '@everydaily/shared/stats/format';
import { headToHead, type HeadToHead } from '@everydaily/shared/stats/head-to-head';
import { currentPuzzle } from '@everydaily/shared/time/puzzle';
import { addDays, localDate } from '@everydaily/shared/time/zoned';
import { db } from './db';
import { HttpError } from './session';

export const usernameInputSchema = z
  .object({ username: z.string().trim().toLowerCase().min(3).max(20) })
  .strict();

/** Friendships are stored once per pair, smaller id first. */
const pair = (a: string, b: string): [string, string] => (a < b ? [a, b] : [b, a]);

async function row(me: string, other: string) {
  const [a, b] = pair(me, other);
  const [r] = await db()
    .select()
    .from(friendships)
    .where(and(eq(friendships.userA, a), eq(friendships.userB, b)));
  return r ?? null;
}

const NOT_FOUND = () => new HttpError(404, 'not_found', 'No player with that name.');

/**
 * Sends a friend request by exact username, or accepts theirs if they already asked. A block in
 * either direction answers exactly like a missing player, so blocks aren't revealed.
 */
export async function requestFriend(me: { id: string; username: string }, username: string) {
  if (username === me.username.toLowerCase())
    throw new HttpError(422, 'self', "That's you! Add someone else.");
  const [other] = await db()
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(and(eq(users.username, username), isNull(users.deletedAt)));
  if (!other) throw NOT_FOUND();
  const existing = await row(me.id, other.id);
  if (existing?.status === 'blocked') throw NOT_FOUND();
  if (existing?.status === 'accepted')
    throw new HttpError(409, 'already_friends', `You're already friends with ${other.username}.`);
  if (existing?.status === 'pending') {
    if (existing.requestedBy === me.id)
      throw new HttpError(409, 'already_sent', `You already asked ${other.username}.`);
    await accept(me.id, other.id);
    return { status: 'accepted' as const, username: other.username };
  }
  const [a, b] = pair(me.id, other.id);
  await db()
    .insert(friendships)
    .values({ userA: a, userB: b, status: 'pending', requestedBy: me.id })
    .onConflictDoNothing();
  return { status: 'pending' as const, username: other.username };
}

export async function accept(me: string, other: string) {
  const r = await row(me, other);
  if (!r || r.status !== 'pending' || r.requestedBy === me)
    throw new HttpError(404, 'not_found', 'No request from that player.');
  await db()
    .update(friendships)
    .set({ status: 'accepted', acceptedAt: new Date() })
    .where(and(eq(friendships.userA, r.userA), eq(friendships.userB, r.userB)));
}

/** Declines, cancels, unfriends or unblocks. Can't undo a block someone else placed. */
export async function removeFriendship(me: string, other: string) {
  const r = await row(me, other);
  if (!r || (r.status === 'blocked' && r.requestedBy !== me)) return;
  await db()
    .delete(friendships)
    .where(and(eq(friendships.userA, r.userA), eq(friendships.userB, r.userB)));
}

/** Blocks a player: any friendship or request between you is replaced by the block. */
export async function block(me: string, other: string) {
  if (me === other) throw new HttpError(422, 'self', "You can't block yourself.");
  const [a, b] = pair(me, other);
  const existing = await row(me, other);
  if (existing?.status === 'blocked' && existing.requestedBy !== me) return;
  await db()
    .insert(friendships)
    .values({ userA: a, userB: b, status: 'blocked', requestedBy: me })
    .onConflictDoUpdate({
      target: [friendships.userA, friendships.userB],
      set: { status: 'blocked', requestedBy: me, acceptedAt: null },
    });
}

export interface FriendRow {
  id: string;
  username: string;
  displayName: string | null;
  /** Results logged for puzzles dated today (in the viewer's timezone). */
  playedToday: number;
}

export interface FriendLists {
  friends: FriendRow[];
  incoming: Omit<FriendRow, 'playedToday'>[];
  outgoing: Omit<FriendRow, 'playedToday'>[];
  blocked: Omit<FriendRow, 'playedToday'>[];
}

export async function friendLists(me: { id: string; timezone: string }): Promise<FriendLists> {
  const rows = await db()
    .select({
      userA: friendships.userA,
      userB: friendships.userB,
      status: friendships.status,
      requestedBy: friendships.requestedBy,
      acceptedAt: friendships.acceptedAt,
    })
    .from(friendships)
    .where(or(eq(friendships.userA, me.id), eq(friendships.userB, me.id)))
    .orderBy(desc(friendships.createdAt));
  const otherIds = rows.map((r) => (r.userA === me.id ? r.userB : r.userA));
  if (!otherIds.length) return { friends: [], incoming: [], outgoing: [], blocked: [] };
  const people = await db()
    .select({ id: users.id, username: users.username, displayName: users.displayName })
    .from(users)
    .where(and(inArray(users.id, otherIds), isNull(users.deletedAt)));
  const byId = new Map(people.map((p) => [p.id, p]));

  const friendIds = rows
    .filter((r) => r.status === 'accepted')
    .map((r) => (r.userA === me.id ? r.userB : r.userA));
  const counts = new Map<string, number>();
  if (friendIds.length) {
    const today = localDate(new Date(), me.timezone);
    const played = await db()
      .select({ userId: results.userId })
      .from(results)
      .where(and(inArray(results.userId, friendIds), eq(results.puzzleDate, today)));
    for (const p of played) counts.set(p.userId, (counts.get(p.userId) ?? 0) + 1);
  }

  const out: FriendLists = { friends: [], incoming: [], outgoing: [], blocked: [] };
  for (const r of rows) {
    const p = byId.get(r.userA === me.id ? r.userB : r.userA);
    if (!p) continue;
    if (r.status === 'accepted') out.friends.push({ ...p, playedToday: counts.get(p.id) ?? 0 });
    else if (r.status === 'pending')
      (r.requestedBy === me.id ? out.outgoing : out.incoming).push(p);
    else if (r.requestedBy === me.id) out.blocked.push(p);
  }
  out.friends.sort((a, b) => a.username.localeCompare(b.username));
  return out;
}

/** A friend by username, or null when not friends (or blocked, or no such player). */
export async function friendByUsername(meId: string, username: string) {
  const [other] = await db()
    .select({ id: users.id, username: users.username, displayName: users.displayName })
    .from(users)
    .where(and(eq(users.username, username.toLowerCase()), isNull(users.deletedAt)));
  if (!other || other.id === meId) return null;
  const r = await row(meId, other.id);
  return r?.status === 'accepted' ? other : null;
}

export interface H2HGame {
  game: { slug: string; name: string; icon: string; accentColor: string };
  h2h: HeadToHead;
  /** Today's puzzle: each side's result, theirs hidden until you log yours (spoiler-safe). */
  today: { mine: string | null; theirs: string | null; hidden: boolean };
}

const WINDOW_DAYS = 90;

/** Head-to-head over the last 90 days, per game both of you played. */
export async function compareWith(
  me: { id: string; timezone: string; spoilerSafe: boolean },
  friendId: string,
  now = new Date(),
): Promise<H2HGame[]> {
  const since = addDays(localDate(now, me.timezone), -WINDOW_DAYS);
  const rows = await db()
    .select({
      userId: results.userId,
      puzzleNumber: results.puzzleNumber,
      solved: results.solved,
      attempts: results.attempts,
      maxAttempts: results.maxAttempts,
      timeSeconds: results.timeSeconds,
      score: results.score,
      game: games,
    })
    .from(results)
    .innerJoin(games, eq(games.id, results.gameId))
    .where(and(inArray(results.userId, [me.id, friendId]), gte(results.puzzleDate, since)));

  const byGame = new Map<
    string,
    { game: (typeof rows)[number]['game']; mine: typeof rows; theirs: typeof rows }
  >();
  for (const r of rows) {
    const g = byGame.get(r.game.id) ?? { game: r.game, mine: [], theirs: [] };
    (r.userId === me.id ? g.mine : g.theirs).push(r);
    byGame.set(r.game.id, g);
  }

  const out: H2HGame[] = [];
  for (const { game, mine, theirs } of byGame.values()) {
    if (!mine.length || !theirs.length) continue;
    const h2h = headToHead(mine, theirs, game.scoringType);
    const today = currentPuzzle(clockFromGame(game), now, me.timezone).number;
    const fmt = { type: game.scoringType, unit: game.scoringUnit };
    const myToday = mine.find((r) => r.puzzleNumber === today);
    const theirToday = theirs.find((r) => r.puzzleNumber === today);
    const hidden = Boolean(theirToday) && !myToday && me.spoilerSafe;
    out.push({
      game: { slug: game.slug, name: game.name, icon: game.icon, accentColor: game.accentColor },
      h2h,
      today: {
        mine: myToday ? formatResult(myToday, fmt) : null,
        theirs: theirToday && !hidden ? formatResult(theirToday, fmt) : null,
        hidden,
      },
    });
  }
  return out.sort((a, b) => b.h2h.shared - a.h2h.shared || a.game.name.localeCompare(b.game.name));
}
