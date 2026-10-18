import 'server-only';
import { z } from 'zod';
import {
  and,
  asc,
  communities,
  communityModerators,
  comments,
  contentReports,
  desc,
  eq,
  flairs,
  follows,
  games,
  inArray,
  ne,
  posts,
  results,
  sql,
  users,
  votes,
  type Game,
} from '@everydaily/shared/db';
import { hotScore, placeComment } from '@everydaily/shared/community/ranking';
import {
  FLAIR_COLORS,
  GLOBAL_COMMUNITY,
  MAX_COMMENT_BODY,
  MAX_POST_BODY,
  MAX_POST_TITLE,
  type ContentStatus,
  type VoteTarget,
} from '@everydaily/shared/domain';
import { clockFromGame } from '@everydaily/shared/registry';
import { currentPuzzle } from '@everydaily/shared/time/puzzle';
import { uuidv7 } from '@everydaily/shared/util/uuidv7';
import { excerpt, renderMarkdown } from '@/lib/markdown';
import { recordModAction } from './catalog/moderation';
import { db } from './db';
import { hasRole } from './roles';
import { HttpError } from './session';

type Viewer = { id: string; timezone: string; role: 'user' | 'mod' | 'admin' };
export const isModerator = (v: Pick<Viewer, 'role'>) => hasRole(v, 'mod');

/** Whether the player moderates this community: a site moderator, or appointed to it. */
export async function canModerateBoard(viewer: Pick<Viewer, 'id' | 'role'>, communityId: string) {
  if (isModerator(viewer)) return true;
  const [m] = await db()
    .select({ userId: communityModerators.userId })
    .from(communityModerators)
    .where(
      and(
        eq(communityModerators.communityId, communityId),
        eq(communityModerators.userId, viewer.id),
      ),
    )
    .limit(1);
  return Boolean(m);
}

/** 404 when there's no such community, 403 unless the player moderates it. */
export async function assertCanModerate(
  viewer: Pick<Viewer, 'id' | 'role'>,
  communityId: string | null,
) {
  if (!communityId) throw new HttpError(404, 'not_found', 'Not found.');
  if (!(await canModerateBoard(viewer, communityId)))
    throw new HttpError(403, 'forbidden', 'You do not have access to this.');
}

export const postInputSchema = z
  .object({
    title: z.string().trim().min(1, 'Add a title.').max(MAX_POST_TITLE),
    body: z.string().max(MAX_POST_BODY).default(''),
    flairId: z.string().uuid().nullable().optional(),
    spoiler: z.boolean().default(false),
  })
  .strict();

export const commentInputSchema = z
  .object({
    body: z.string().trim().min(1, 'Write something first.').max(MAX_COMMENT_BODY),
    parentId: z.string().uuid().nullable().optional(),
    spoiler: z.boolean().default(false),
  })
  .strict();

export const voteInputSchema = z
  .object({ value: z.union([z.literal(-1), z.literal(0), z.literal(1)]) })
  .strict();

export const reportInputSchema = z
  .object({ reason: z.string().trim().min(1, 'Say what is wrong.').max(300) })
  .strict();

export const modInputSchema = z
  .object({
    action: z.enum(['remove', 'restore', 'lock', 'unlock']),
    reason: z.string().trim().max(300).optional(),
  })
  .strict();

export const flairInputSchema = z
  .object({ name: z.string().trim().min(1).max(24), color: z.enum(FLAIR_COLORS) })
  .strict();

const NOT_FOUND = () => new HttpError(404, 'not_found', 'Not found.');

export type Community = typeof communities.$inferSelect;

/**
 * The community for a slug: the global one, or the one for the game with that slug (created
 * the first time it is opened). Archived games have none.
 */
export async function ensureCommunity(
  slug: string,
): Promise<{ community: Community; game: Game | null } | null> {
  if (slug === GLOBAL_COMMUNITY) {
    await db()
      .insert(communities)
      .values({
        slug,
        name: 'EveryDaily',
        description: 'Everything daily puzzles: tips, streaks, new finds and chat.',
      })
      .onConflictDoNothing();
    const [c] = await db().select().from(communities).where(eq(communities.slug, slug));
    return c ? { community: c, game: null } : null;
  }
  const [game] = await db()
    .select()
    .from(games)
    .where(and(eq(games.slug, slug), ne(games.status, 'archived')));
  if (!game) return null;
  await db()
    .insert(communities)
    .values({
      slug,
      name: game.name,
      description: `Talk about ${game.name}: strategies, streaks and the daily thread.`,
      gameId: game.id,
    })
    .onConflictDoNothing();
  const [c] = await db().select().from(communities).where(eq(communities.slug, slug));
  return c ? { community: c, game } : null;
}

const puzzleLabel = (g: Game, n: number, date: string) =>
  g.numberingPublic
    ? `#${n.toLocaleString('en-US')}`
    : new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      });

/**
 * Today's discussion thread for a game, created automatically the first time anyone opens the
 * community on that puzzle. Comments on it are spoilers until you log the puzzle.
 */
export async function ensureDailyThread(community: Community, game: Game, viewerTz: string) {
  const p = currentPuzzle(clockFromGame(game), new Date(), viewerTz);
  await db()
    .insert(posts)
    .values({
      communityId: community.id,
      authorId: null,
      title: `Daily thread: ${game.name} ${puzzleLabel(game, p.number, p.date)}`,
      bodyMd:
        "Talk about today's puzzle here. Comments are hidden until you've logged your result, so nobody spoils it for you.",
      isDailyThread: true,
      puzzleNumber: p.number,
      spoiler: true,
    })
    .onConflictDoNothing();
  const [post] = await db()
    .select({ id: posts.id, title: posts.title, commentCount: posts.commentCount })
    .from(posts)
    .where(
      and(
        eq(posts.communityId, community.id),
        eq(posts.isDailyThread, true),
        eq(posts.puzzleNumber, p.number),
      ),
    );
  return post ?? null;
}

export interface FeedPost {
  id: string;
  title: string;
  excerpt: string;
  author: string | null;
  flair: { name: string; color: string } | null;
  score: number;
  commentCount: number;
  spoiler: boolean;
  status: ContentStatus;
  isDailyThread: boolean;
  createdAt: string;
  myVote: number;
}

export async function feed(
  viewer: Viewer,
  communityId: string,
  opts: { sort: 'hot' | 'new'; flairId?: string | null; showRemoved?: boolean },
  now = new Date(),
): Promise<FeedPost[]> {
  const conditions = [eq(posts.communityId, communityId), eq(posts.isDailyThread, false)];
  if (!opts.showRemoved) conditions.push(ne(posts.status, 'removed'));
  if (opts.flairId) conditions.push(eq(posts.flairId, opts.flairId));
  const rows = await db()
    .select({
      post: posts,
      author: users.username,
      flairName: flairs.name,
      flairColor: flairs.color,
    })
    .from(posts)
    .leftJoin(users, eq(users.id, posts.authorId))
    .leftJoin(flairs, eq(flairs.id, posts.flairId))
    .where(and(...conditions))
    .orderBy(desc(posts.createdAt))
    .limit(200);
  const sorted =
    opts.sort === 'new'
      ? rows
      : [...rows].sort(
          (a, b) =>
            hotScore(b.post.score, b.post.createdAt, now) -
            hotScore(a.post.score, a.post.createdAt, now),
        );
  const top = sorted.slice(0, 50);
  const mine = await myVotes(
    viewer.id,
    'post',
    top.map((r) => r.post.id),
  );
  return top.map(({ post, author, flairName, flairColor }) => ({
    id: post.id,
    title: post.title,
    excerpt: post.spoiler ? '' : excerpt(post.bodyMd),
    author,
    flair: flairName && flairColor ? { name: flairName, color: flairColor } : null,
    score: post.score,
    commentCount: post.commentCount,
    spoiler: post.spoiler,
    status: post.status,
    isDailyThread: post.isDailyThread,
    createdAt: post.createdAt.toISOString(),
    myVote: mine.get(post.id) ?? 0,
  }));
}

async function myVotes(userId: string, type: VoteTarget, ids: string[]) {
  if (!ids.length) return new Map<string, number>();
  const rows = await db()
    .select({ id: votes.targetId, value: votes.value })
    .from(votes)
    .where(and(eq(votes.userId, userId), eq(votes.targetType, type), inArray(votes.targetId, ids)));
  return new Map(rows.map((r) => [r.id, r.value]));
}

export async function createPost(
  user: { id: string },
  community: Community,
  input: z.infer<typeof postInputSchema>,
) {
  if (input.flairId) {
    const [f] = await db()
      .select({ id: flairs.id })
      .from(flairs)
      .where(and(eq(flairs.id, input.flairId), eq(flairs.communityId, community.id)));
    if (!f) throw new HttpError(422, 'bad_flair', 'That flair is not part of this community.');
  }
  const [p] = await db()
    .insert(posts)
    .values({
      communityId: community.id,
      authorId: user.id,
      title: input.title,
      bodyMd: input.body.replace(/\r\n?/g, '\n'),
      flairId: input.flairId ?? null,
      spoiler: input.spoiler,
    })
    .returning({ id: posts.id });
  return { id: p!.id };
}

export interface CommentView {
  id: string;
  path: string;
  depth: number;
  author: string | null;
  html: string | null;
  spoiler: boolean;
  score: number;
  myVote: number;
  status: ContentStatus;
  createdAt: string;
  mine: boolean;
}

export interface PostView {
  id: string;
  community: { id: string; slug: string; name: string };
  /** The viewer may moderate this post's community. */
  canModerate: boolean;
  title: string;
  html: string;
  author: string | null;
  flair: { name: string; color: string } | null;
  score: number;
  myVote: number;
  commentCount: number;
  spoiler: boolean;
  status: ContentStatus;
  isDailyThread: boolean;
  createdAt: string;
  mine: boolean;
  /** Daily thread the viewer hasn't logged yet: comment bodies stay blurred. */
  hideComments: boolean;
  comments: CommentView[];
}

/** A post with its comments, as the viewer may see it (removed content only for moderators). */
export async function postView(viewer: Viewer, postId: string): Promise<PostView | null> {
  if (!z.string().uuid().safeParse(postId).success) return null;
  const [row] = await db()
    .select({
      post: posts,
      community: communities,
      author: users.username,
      flairName: flairs.name,
      flairColor: flairs.color,
    })
    .from(posts)
    .innerJoin(communities, eq(communities.id, posts.communityId))
    .leftJoin(users, eq(users.id, posts.authorId))
    .leftJoin(flairs, eq(flairs.id, posts.flairId))
    .where(eq(posts.id, postId));
  if (!row) return null;
  const mod = await canModerateBoard(viewer, row.community.id);
  if (row.post.status === 'removed' && !mod && row.post.authorId !== viewer.id) return null;

  const commentRows = await db()
    .select({ c: comments, author: users.username })
    .from(comments)
    .leftJoin(users, eq(users.id, comments.authorId))
    .where(eq(comments.postId, postId))
    .orderBy(asc(comments.path));

  let hideComments = false;
  if (row.post.isDailyThread && row.community.gameId && row.post.puzzleNumber !== null) {
    const logged = await db()
      .select({ id: results.id })
      .from(results)
      .where(
        and(
          eq(results.userId, viewer.id),
          eq(results.gameId, row.community.gameId),
          eq(results.puzzleNumber, row.post.puzzleNumber),
        ),
      )
      .limit(1);
    hideComments = logged.length === 0;
  }

  const [postVotes, commentVotes] = await Promise.all([
    myVotes(viewer.id, 'post', [postId]),
    myVotes(
      viewer.id,
      'comment',
      commentRows.map((r) => r.c.id),
    ),
  ]);
  return {
    id: row.post.id,
    community: { id: row.community.id, slug: row.community.slug, name: row.community.name },
    canModerate: mod,
    title: row.post.title,
    html: renderMarkdown(row.post.bodyMd),
    author: row.author,
    flair: row.flairName && row.flairColor ? { name: row.flairName, color: row.flairColor } : null,
    score: row.post.score,
    myVote: postVotes.get(postId) ?? 0,
    commentCount: row.post.commentCount,
    spoiler: row.post.spoiler && !row.post.isDailyThread,
    status: row.post.status,
    isDailyThread: row.post.isDailyThread,
    createdAt: row.post.createdAt.toISOString(),
    mine: row.post.authorId === viewer.id,
    hideComments,
    comments: commentRows.map(({ c, author }) => {
      const visible = c.status !== 'removed' || mod;
      return {
        id: c.id,
        path: c.path,
        depth: c.depth,
        author: c.status === 'removed' && !mod ? null : author,
        html: visible ? renderMarkdown(c.bodyMd) : null,
        spoiler: c.spoiler,
        score: c.score,
        myVote: commentVotes.get(c.id) ?? 0,
        status: c.status,
        createdAt: c.createdAt.toISOString(),
        mine: c.authorId === viewer.id,
      };
    }),
  };
}

export async function addComment(
  user: { id: string },
  postId: string,
  input: z.infer<typeof commentInputSchema>,
) {
  return db().transaction(async (tx) => {
    const [post] = await tx
      .select({ id: posts.id, status: posts.status })
      .from(posts)
      .where(eq(posts.id, postId))
      .for('update');
    if (!post || post.status === 'removed') throw NOT_FOUND();
    if (post.status === 'locked')
      throw new HttpError(403, 'locked', 'This post is locked; no new comments.');
    let parent: { path: string; depth: number } | null = null;
    if (input.parentId) {
      const [p] = await tx
        .select({ path: comments.path, depth: comments.depth })
        .from(comments)
        .where(and(eq(comments.id, input.parentId), eq(comments.postId, postId)));
      if (!p) throw new HttpError(404, 'not_found', 'That comment is gone.');
      parent = p;
    }
    const id = uuidv7();
    const place = placeComment(id, parent);
    const parentId = place.parentPath ? place.parentPath.split('/').pop()! : null;
    await tx.insert(comments).values({
      id,
      postId,
      parentId,
      authorId: user.id,
      bodyMd: input.body.replace(/\r\n?/g, '\n'),
      depth: place.depth,
      path: place.path,
      spoiler: input.spoiler,
    });
    await tx
      .update(posts)
      .set({ commentCount: sql`${posts.commentCount} + 1`, lastActivityAt: new Date() })
      .where(eq(posts.id, postId));
    return { id };
  });
}

/** Sets the viewer's vote (-1, 0 to clear, 1) and keeps the target's score in step. */
export async function vote(userId: string, type: VoteTarget, targetId: string, value: -1 | 0 | 1) {
  const table = type === 'post' ? posts : comments;
  return db().transaction(async (tx) => {
    const [target] = await tx
      .select({ id: table.id, status: table.status })
      .from(table)
      .where(eq(table.id, targetId))
      .for('update');
    if (!target || target.status === 'removed') throw NOT_FOUND();
    const [prev] = await tx
      .select({ value: votes.value })
      .from(votes)
      .where(
        and(eq(votes.userId, userId), eq(votes.targetType, type), eq(votes.targetId, targetId)),
      );
    const delta = value - (prev?.value ?? 0);
    if (value === 0) {
      await tx
        .delete(votes)
        .where(
          and(eq(votes.userId, userId), eq(votes.targetType, type), eq(votes.targetId, targetId)),
        );
    } else {
      await tx
        .insert(votes)
        .values({ userId, targetType: type, targetId, value })
        .onConflictDoUpdate({
          target: [votes.userId, votes.targetType, votes.targetId],
          set: { value },
        });
    }
    const [updated] = await tx
      .update(table)
      .set({ score: sql`${table.score} + ${delta}` })
      .where(eq(table.id, targetId))
      .returning({ score: table.score });
    return { score: updated!.score, myVote: value };
  });
}

export async function report(userId: string, type: VoteTarget, targetId: string, reason: string) {
  const table = type === 'post' ? posts : comments;
  const [t] = await db().select({ id: table.id }).from(table).where(eq(table.id, targetId));
  if (!t) throw NOT_FOUND();
  await db()
    .insert(contentReports)
    .values({ reporterId: userId, targetType: type, targetId, reason })
    .onConflictDoNothing();
}

/** The author removes their own post or comment. */
export async function deleteOwn(userId: string, type: VoteTarget, targetId: string) {
  const table = type === 'post' ? posts : comments;
  const updated = await db()
    .update(table)
    .set({ status: 'removed' })
    .where(and(eq(table.id, targetId), eq(table.authorId, userId)))
    .returning({ id: table.id });
  if (!updated.length) throw NOT_FOUND();
}

/**
 * Moderator actions on posts and comments, each written to the audit log. Removing content
 * also resolves its open reports.
 */
export async function moderate(
  actorId: string,
  type: VoteTarget,
  targetId: string,
  input: z.infer<typeof modInputSchema>,
) {
  const table = type === 'post' ? posts : comments;
  if (type === 'comment' && (input.action === 'lock' || input.action === 'unlock'))
    throw new HttpError(422, 'invalid', 'Only posts can be locked.');
  const next: ContentStatus =
    input.action === 'remove' ? 'removed' : input.action === 'lock' ? 'locked' : 'visible';
  await db().transaction(async (tx) => {
    const [t] = await tx
      .select({ status: table.status })
      .from(table)
      .where(eq(table.id, targetId))
      .for('update');
    if (!t) throw NOT_FOUND();
    await tx.update(table).set({ status: next }).where(eq(table.id, targetId));
    if (input.action === 'remove') {
      await tx
        .update(contentReports)
        .set({ status: 'resolved', resolvedBy: actorId, resolvedAt: new Date() })
        .where(
          and(
            eq(contentReports.targetType, type),
            eq(contentReports.targetId, targetId),
            eq(contentReports.status, 'open'),
          ),
        );
    }
    await recordModAction(tx, {
      actorId,
      action: `${type}.${input.action}`,
      targetType: type,
      targetId,
      reason: input.reason,
      before: { status: t.status },
      after: { status: next },
    });
  });
}

export async function dismissReport(actorId: string, reportId: string) {
  await db().transaction(async (tx) => {
    const [r] = await tx
      .select()
      .from(contentReports)
      .where(eq(contentReports.id, reportId))
      .for('update');
    if (!r) throw NOT_FOUND();
    if (r.status !== 'open') throw new HttpError(409, 'already_decided', 'Already handled.');
    await tx
      .update(contentReports)
      .set({ status: 'dismissed', resolvedBy: actorId, resolvedAt: new Date() })
      .where(eq(contentReports.id, reportId));
    await recordModAction(tx, {
      actorId,
      action: 'content_report.dismiss',
      targetType: 'content_report',
      targetId: reportId,
      before: { status: 'open' },
      after: { status: 'dismissed' },
    });
  });
}

/**
 * Open content reports with a preview of what was reported, for the moderation queue. With a
 * community slug, only that board's reports (a board moderator's queue).
 */
export async function openContentReports(boardSlug?: string) {
  const rows = await db()
    .select({ report: contentReports, reporter: users.username })
    .from(contentReports)
    .leftJoin(users, eq(users.id, contentReports.reporterId))
    .where(eq(contentReports.status, 'open'))
    .orderBy(asc(contentReports.createdAt))
    .limit(boardSlug ? 500 : 100);
  const postIds = rows.filter((r) => r.report.targetType === 'post').map((r) => r.report.targetId);
  const commentIds = rows
    .filter((r) => r.report.targetType === 'comment')
    .map((r) => r.report.targetId);
  const [postRows, commentRows] = await Promise.all([
    postIds.length
      ? db()
          .select({
            id: posts.id,
            title: posts.title,
            body: posts.bodyMd,
            postId: posts.id,
            status: posts.status,
          })
          .from(posts)
          .where(inArray(posts.id, postIds))
      : [],
    commentIds.length
      ? db()
          .select({
            id: comments.id,
            title: sql<string>`''`,
            body: comments.bodyMd,
            postId: comments.postId,
            status: comments.status,
          })
          .from(comments)
          .where(inArray(comments.id, commentIds))
      : [],
  ]);
  const targets = new Map([...postRows, ...commentRows].map((t) => [t.id, t]));
  const allPostIds = [...new Set([...targets.values()].map((t) => t.postId))];
  const slugs = new Map(
    (allPostIds.length
      ? await db()
          .select({ id: posts.id, slug: communities.slug })
          .from(posts)
          .innerJoin(communities, eq(communities.id, posts.communityId))
          .where(inArray(posts.id, allPostIds))
      : []
    ).map((r) => [r.id, r.slug]),
  );
  return rows.flatMap(({ report: r, reporter }) => {
    const t = targets.get(r.targetId);
    if (!t) return [];
    if (boardSlug && slugs.get(t.postId) !== boardSlug) return [];
    return [
      {
        id: r.id,
        targetType: r.targetType,
        targetId: r.targetId,
        postId: t.postId,
        communitySlug: slugs.get(t.postId) ?? '',
        preview: t.title || excerpt(t.body, 220),
        targetStatus: t.status,
        reason: r.reason,
        reporter,
        createdAt: r.createdAt.toISOString(),
      },
    ];
  });
}

/** The community a post or comment belongs to, or null when it doesn't exist. */
export async function communityOfTarget(type: VoteTarget, id: string): Promise<string | null> {
  const [row] =
    type === 'post'
      ? await db()
          .select({ communityId: posts.communityId })
          .from(posts)
          .where(eq(posts.id, id))
          .limit(1)
      : await db()
          .select({ communityId: posts.communityId })
          .from(comments)
          .innerJoin(posts, eq(posts.id, comments.postId))
          .where(eq(comments.id, id))
          .limit(1);
  return row?.communityId ?? null;
}

export async function communityOfReport(reportId: string): Promise<string | null> {
  const [r] = await db()
    .select({ type: contentReports.targetType, id: contentReports.targetId })
    .from(contentReports)
    .where(eq(contentReports.id, reportId))
    .limit(1);
  return r ? communityOfTarget(r.type as VoteTarget, r.id) : null;
}

export async function communityOfFlair(flairId: string): Promise<string | null> {
  const [f] = await db()
    .select({ communityId: flairs.communityId })
    .from(flairs)
    .where(eq(flairs.id, flairId))
    .limit(1);
  return f?.communityId ?? null;
}

export async function listBoardModerators(communityId: string) {
  return db()
    .select({ userId: users.id, username: users.username, since: communityModerators.createdAt })
    .from(communityModerators)
    .innerJoin(users, eq(users.id, communityModerators.userId))
    .where(eq(communityModerators.communityId, communityId))
    .orderBy(asc(communityModerators.createdAt));
}

export const moderatorInputSchema = z
  .object({ username: z.string().trim().toLowerCase().min(3).max(20) })
  .strict();

/** Appoints a player as a community moderator (site moderators only; audit-logged). */
export async function addBoardModerator(actorId: string, communityId: string, username: string) {
  const [u] = await db()
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.username, username), sql`${users.deletedAt} IS NULL`))
    .limit(1);
  if (!u) throw new HttpError(404, 'not_found', 'No player with that name.');
  const [added] = await db()
    .insert(communityModerators)
    .values({ communityId, userId: u.id, addedBy: actorId })
    .onConflictDoNothing()
    .returning({ userId: communityModerators.userId });
  if (!added) throw new HttpError(409, 'exists', 'Already a moderator here.');
  await recordModAction(db(), {
    actorId,
    action: 'community_moderator.add',
    targetType: 'community',
    targetId: communityId,
    after: { userId: u.id, username },
  });
}

export async function removeBoardModerator(actorId: string, communityId: string, userId: string) {
  const [gone] = await db()
    .delete(communityModerators)
    .where(
      and(eq(communityModerators.communityId, communityId), eq(communityModerators.userId, userId)),
    )
    .returning({ userId: communityModerators.userId });
  if (!gone) throw NOT_FOUND();
  await recordModAction(db(), {
    actorId,
    action: 'community_moderator.remove',
    targetType: 'community',
    targetId: communityId,
    before: { userId },
  });
}

export async function listFlairs(communityId: string) {
  return db()
    .select({ id: flairs.id, name: flairs.name, color: flairs.color })
    .from(flairs)
    .where(eq(flairs.communityId, communityId))
    .orderBy(asc(flairs.name));
}

export async function createFlair(
  actorId: string,
  communityId: string,
  input: z.infer<typeof flairInputSchema>,
) {
  const [f] = await db()
    .insert(flairs)
    .values({ communityId, ...input })
    .onConflictDoNothing()
    .returning({ id: flairs.id });
  if (!f) throw new HttpError(409, 'exists', 'A flair with that name already exists.');
  await recordModAction(db(), {
    actorId,
    action: 'flair.create',
    targetType: 'flair',
    targetId: f.id,
    after: input,
  });
  return f;
}

export async function deleteFlair(actorId: string, flairId: string) {
  const [f] = await db().delete(flairs).where(eq(flairs.id, flairId)).returning();
  if (!f) throw NOT_FOUND();
  await recordModAction(db(), {
    actorId,
    action: 'flair.delete',
    targetType: 'flair',
    targetId: flairId,
    before: { name: f.name, color: f.color },
  });
}

/** Communities for the index: the global one, then those for games the viewer follows. */
export async function communityIndex(viewer: Viewer) {
  const followed = await db()
    .select({
      slug: games.slug,
      name: games.name,
      icon: games.icon,
      accentColor: games.accentColor,
    })
    .from(follows)
    .innerJoin(games, eq(games.id, follows.gameId))
    .where(and(eq(follows.userId, viewer.id), ne(games.status, 'archived')))
    .orderBy(asc(follows.position));
  const active = await db()
    .select({
      slug: communities.slug,
      name: communities.name,
      posts: sql<number>`count(${posts.id})::int`,
    })
    .from(communities)
    .innerJoin(posts, and(eq(posts.communityId, communities.id), eq(posts.isDailyThread, false)))
    .where(sql`${posts.createdAt} > now() - interval '7 days'`)
    .groupBy(communities.slug, communities.name)
    .orderBy(desc(sql`count(${posts.id})`))
    .limit(8);
  return { followed, active };
}
